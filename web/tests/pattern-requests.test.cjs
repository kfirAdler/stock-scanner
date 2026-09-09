const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');

function loadRoute(relative, overrides) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => overrides[name] ?? require(name), module, module.exports);
  return module.exports;
}
function fixture(data, gate = { response: null, userId: 'trusted-user' }, options = {}) {
  data = structuredClone(data);
  const calls = [];
  const background = [];
  const processed = [];
  let claims = 0;
  const overrides = {
    'next/server': { NextRequest, NextResponse, after: callback => background.push(callback) },
    '@/lib/patterns/worker': {
      claimPatternRequest: async () => { claims++; if (options.claimError) throw new Error('claim failed'); return options.claimed ?? null; },
      processPatternRequests: async job => { processed.push(job); },
    },
    '@/lib/patterns/request-access': { authorizePatternRequest: async () => gate },
    '@/lib/supabase/server': { createServiceClient: async () => ({ rpc: async (...args) => { calls.push(args); return { data, error: null }; } }) },
  };
  return { route: loadRoute('app/api/patterns/requests/route.ts', overrides), detail: loadRoute('app/api/patterns/requests/detail/route.ts', overrides), calls, background, processed, get claims() { return claims; } };
}
const post = body => new NextRequest('http://localhost/api/patterns/requests', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
const accepted = { accepted:true, serverTime:'2026-09-08T12:00:00Z', nextAllowedAt:'2026-09-08T14:00:00Z', job:{id:'job-1',status:'queued'} };

test('anonymous and forbidden requests stop before database access', async () => {
  for (const status of [401,403]) {
    const f = fixture(null, { response:NextResponse.json({}, {status}), userId:null });
    assert.equal((await f.route.POST(post({pattern:'channel',market:'US'}))).status,status);
    assert.equal((await f.route.GET()).status,status);
    assert.equal(f.calls.length,0);
  }
});
test('only one valid pattern and one market may be requested', async () => {
  const f = fixture(accepted);
  for (const body of [{pattern:'all',market:'US'}, {pattern:['channel'],market:'US'}, {pattern:'channel',market:'ALL'}, null]) {
    assert.equal((await f.route.POST(post(body))).status,400);
  }
  assert.equal(f.calls.length,0);
});
test('the user identity comes from authentication, never the request body', async () => {
  const f = fixture(accepted);
  const response = await f.route.POST(post({pattern:'channel',market:'TA',userId:'attacker',p_user_id:'attacker'}));
  assert.equal(response.status,202);
  assert.deepEqual(f.calls,[['request_pattern_scan',{p_user_id:'trusted-user',p_pattern:'channel',p_market:'TA'}]]);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('locked requests return 429 with a database-clock Retry-After', async () => {
  const f = fixture({...accepted,accepted:false});
  const response = await f.route.POST(post({pattern:'channel',market:'US'}));
  assert.equal(response.status,429);
  assert.equal(response.headers.get('Retry-After'),'7200');
});
test('a reusable completed scan returns immediately', async () => {
  const f = fixture({...accepted,job:{status:'completed'},reused:true});
  assert.equal((await f.route.POST(post({pattern:'channel',market:'US'}))).status,200);
});
test('status reads do not reserve a new slot', async () => {
  const f = fixture(accepted);
  assert.equal((await f.route.GET()).status,200);
  assert.deepEqual(f.calls,[['pattern_scan_request_status',{p_user_id:'trusted-user'}]]);
});
test('chart lookup passes authenticated identity and returns 404 for inaccessible results', async () => {
  const f = fixture(null);
  const id='00000000-0000-4000-8000-000000000001';
  const response=await f.detail.GET(new NextRequest('http://localhost/api/patterns/requests/detail?jobId='+id+'&ticker=ABC'));
  assert.equal(response.status,404);
  assert.deepEqual(f.calls,[['pattern_scan_detail',{p_user_id:'trusted-user',p_job_id:id,p_ticker:'ABC'}]]);
});

test('button claims queued work before responding and runs it after the response', async () => {
  const claimed = {id:'job-1', leaseId:'lease-1', pattern:'channel', market:'US'};
  const f = fixture(accepted, undefined, {claimed});
  const response = await f.route.POST(post({pattern:'channel',market:'US'}));
  assert.equal(response.status,202);
  assert.equal((await response.json()).job.status,'running');
  assert.equal(f.claims,1);
  assert.equal(f.background.length,1);
  assert.equal(f.processed.length,0);
  await f.background[0]();
  assert.deepEqual(f.processed,[claimed]);
});
test('already running and reusable completed jobs do not start duplicate workers', async () => {
  for (const status of ['running','completed']) {
    const f = fixture({...accepted,job:{id:'job-1',status}});
    await f.route.POST(post({pattern:'channel',market:'US'}));
    assert.equal(f.claims,0);
    assert.equal(f.background.length,0);
  }
});
test('a queued request resumes on return without consuming another quota', async () => {
  const f=fixture(accepted,undefined,{claimed:{id:'job-1',leaseId:'lease-1'}});
  await f.route.GET();
  assert.equal(f.background.length,1);
  assert.deepEqual(f.calls,[['pattern_scan_request_status',{p_user_id:'trusted-user'}]]);
});
test('startup failure reaches the UI instead of silently acknowledging a start', async () => {
  const f=fixture(accepted,undefined,{claimError:true});
  const old=console.error; console.error=()=>{};
  try { assert.equal((await f.route.POST(post({pattern:'channel',market:'US'}))).status,503); }
  finally { console.error=old; }
  assert.equal(f.background.length,0);
});
