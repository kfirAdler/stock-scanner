// Runs against a disposable local PostgreSQL cluster, never a configured Supabase.
// Requires initdb, pg_ctl and psql on PATH. Run with node --test.
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const exec = promisify(execCallback);
let dir;
let started = false;
const port = 56000 + Math.floor(Math.random() * 500);
const sql = async text => (await exec('psql', ['-h', dir, '-p', String(port), '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', text], { maxBuffer: 4_000_000 })).stdout.trim();
const user = async () => { const id = randomUUID(); await sql("insert into auth.users values ('"+id+"')"); return id; };
const request = async (id, pattern = 'channel', market = 'US') => JSON.parse(await sql("select request_pattern_scan('"+id+"','"+pattern+"','"+market+"')"));
const claim = async () => JSON.parse((await sql('select claim_pattern_scan()')) || 'null');
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pattern-request-test-'));
  await exec('initdb', ['-D', join(dir,'data'), '-A', 'trust', '--no-locale']);
  await exec('pg_ctl', ['-D', join(dir,'data'), '-l', join(dir,'log'), '-o', '-p '+port+' -k '+dir+' -h ""', 'start']);
  started = true;
  await sql('create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role; create table symbol_metadata(ticker text primary key, company_name text, market text); create table market_raw_data(ticker text, trade_date date, open numeric, high numeric, low numeric, close numeric, primary key(ticker, trade_date));');
  await exec('psql', ['-h', dir, '-p', String(port), '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', fileURLToPath(new URL('../migrations/025_pattern_scan_requests.sql', import.meta.url))]);
});
beforeEach(async () => { await sql('truncate pattern_scan_requests, pattern_scan_jobs, symbol_metadata, market_raw_data'); });
after(async () => {
  if (started) await exec('pg_ctl', ['-D', join(dir,'data'), '-m', 'fast', 'stop']);
  if (dir) await rm(dir, { recursive: true, force: true });
});

test('one user gets one slot across concurrent requests, all patterns and markets', async () => {
  const id = await user();
  const responses = await Promise.all(Array.from({length:8}, (_,i) => request(id, ['channel','ascending_triangle','cup_and_handle'][i%3], i%2 ? 'TA' : 'US')));
  assert.equal(responses.filter(r => r.accepted).length, 1);
  assert.equal(responses.filter(r => !r.accepted).length, 7);
  assert.equal(new Set(responses.map(r => r.nextAllowedAt)).size, 1);
  const accepted = responses.find(r => r.accepted);
  assert.equal(Date.parse(accepted.nextAllowedAt)-Date.parse(accepted.serverTime), 7_200_000);
});

test('different users have independent quotas but share identical work', async () => {
  const ids = await Promise.all(Array.from({length:6}, () => user()));
  const responses = await Promise.all(ids.map(id => request(id)));
  assert.ok(responses.every(r => r.accepted));
  assert.equal(new Set(responses.map(r => r.job.id)).size, 1);
  assert.equal(await sql('select count(*) from pattern_scan_jobs'), '1');
});

test('cooldown stays locked before expiry and opens at the exact two-hour boundary', async () => {
  const id = await user();
  await request(id);
  assert.equal((await request(id,'cup_and_handle','TA')).accepted, false);
  const result = await sql("begin; update pattern_scan_requests set next_allowed_at=now() where user_id='"+id+"'; select request_pattern_scan('"+id+"','cup_and_handle','TA'); commit;");
  const payload = JSON.parse(result.split('\n').find(line => line.startsWith('{')));
  assert.equal(payload.accepted, true);
  assert.equal(payload.job.pattern, 'cup_and_handle');
});

test('invalid all-pattern requests do not consume a slot', async () => {
  const id = await user();
  await assert.rejects(request(id,'all'));
  await assert.rejects(request(id,'channel','ALL'));
  assert.equal(await sql("select count(*) from pattern_scan_requests where user_id='"+id+"'"), '0');
});

test('only a current worker can publish; summaries omit candles; detail is user-scoped', async () => {
  const owner = await user();
  const stranger = await user();
  const state = await request(owner);
  const job = await claim();
  const payload = JSON.stringify({ rows: [{ ticker:'ABC', candles:[{date:'2026-09-08'}], matches:[] }], coverage:{total:1}, updatedAt:'2026-09-08' });
  const finish = lease => sql("select finish_pattern_scan('"+job.id+"','"+lease+"','"+payload+"'::jsonb)");
  assert.equal(await finish(randomUUID()), 'f');
  assert.equal(await finish(job.leaseId), 't');
  assert.equal(await finish(job.leaseId), 'f');
  const status = JSON.parse(await sql("select pattern_scan_request_status('"+owner+"')"));
  assert.equal(status.job.status, 'completed');
  assert.equal(status.job.summary.rows[0].candles, undefined);
  const detail = await sql("select pattern_scan_detail('"+owner+"','"+job.id+"','ABC')");
  assert.equal(JSON.parse(detail).candles.length, 1);
  assert.equal(await sql("select pattern_scan_detail('"+stranger+"','"+job.id+"','ABC')"), '');
  const reused = await request(stranger);
  assert.equal(reused.job.id, state.job.id);
  assert.equal(reused.reused, true);
  assert.equal(await sql('select count(*) from pattern_scan_jobs'), '1');
});

test('a completed result older than two hours creates a fresh job', async () => {
  const first = await request(await user());
  await sql("update pattern_scan_jobs set status='completed',finished_at=now()-interval '2 hours 1 second' where id='"+first.job.id+"'");
  const next = await request(await user());
  assert.notEqual(next.job.id, first.job.id);
});

test('expired workers retry with a new lease and stop after three attempts', async () => {
  await request(await user());
  const first = await claim();
  assert.equal(await claim(), null);
  await sql("update pattern_scan_jobs set lease_expires_at=now()-interval '1 minute'");
  const second = await claim();
  assert.equal(first.id, second.id);
  assert.notEqual(first.leaseId, second.leaseId);
  assert.equal(await sql("select finish_pattern_scan('"+first.id+"','"+first.leaseId+"',null)"), 'f');
  await sql("update pattern_scan_jobs set lease_expires_at=now()-interval '1 minute', attempts=3");
  assert.equal(await claim(), null);
  assert.equal(await sql('select status from pattern_scan_jobs'), 'failed');
});

test('history reads return twenty complete 160-bar arrays and advance by ticker', async () => {
  await sql("insert into symbol_metadata select 'T'||lpad(i::text,2,'0'), 'Test', 'US' from generate_series(1,22) i; insert into market_raw_data select m.ticker, current_date-i, 100,101,99,100 from symbol_metadata m cross join generate_series(0,199) i;");
  const first = JSON.parse(await sql("select jsonb_agg(r) from pattern_scan_series('US','',20) r"));
  assert.equal(first.length, 20);
  assert.ok(first.every(r => r.candles.length === 160));
  assert.ok(first[0].candles[0].date < first[0].candles[159].date);
  const second = JSON.parse(await sql("select jsonb_agg(r) from pattern_scan_series('US','"+first.at(-1).ticker+"',20) r"));
  assert.equal(second.length, 2);
  assert.ok(second.every(r => r.ticker > first.at(-1).ticker));
});

test('browser roles cannot bypass the backend quota or read jobs directly', async () => {
  for (const role of ['anon','authenticated']) {
    assert.equal(await sql("select has_function_privilege('"+role+"','request_pattern_scan(uuid,text,text)','execute')"), 'f');
    assert.equal(await sql("select has_table_privilege('"+role+"','pattern_scan_jobs','select')"), 'f');
  }
  assert.equal(await sql("select has_function_privilege('service_role','request_pattern_scan(uuid,text,text)','execute')"), 't');
});
