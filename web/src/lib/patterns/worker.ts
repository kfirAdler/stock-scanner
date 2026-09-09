import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { scanSeries, type PatternSeries } from './engine/scan.mjs';
import type { ChannelDiagnostics, PatternKind, PatternPayload, PatternSnapshot } from './types';

type Job = { id: string; leaseId: string; pattern: PatternKind; market: 'US' | 'TA' };
type Database = Awaited<ReturnType<typeof createServiceClient>>;

async function scanJob(db: Database, job: Job, deadline: number): Promise<PatternPayload> {
  const started = Date.now();
  const diagnostics: ChannelDiagnostics | undefined = job.pattern === 'channel' ? { pattern: 'channel', rejected: {}, strictMatches: 0, developingSetups: 0 } : undefined;
  const rows: PatternSnapshot[] = [];
  const coverage = { total: 0, scanned: 0, stale: 0, insufficient: 0 };
  let cursor = '';
  const now = new Date();
  while (true) {
    if (Date.now() > deadline - 15_000) throw new Error('Pattern worker time budget exceeded');
    let batch: PatternSeries[] | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await db.rpc('pattern_scan_series', {
        p_market: job.market, p_after: cursor, p_batch_size: 20,
      }).abortSignal(AbortSignal.timeout(Math.max(1, Math.min(20_000, deadline - Date.now() - 10_000))));
      if (!error) { batch = data as PatternSeries[]; break; }
      if (attempt === 2 || Date.now() > deadline - 30_000) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
    if (!batch) throw new Error('Pattern history unavailable');
    if (!batch.length) break;
    for (const row of scanSeries(batch, now, job.pattern)) {
      coverage.total++;
      coverage[row.status === 'insufficient_history' ? 'insufficient' : row.status]++;
      if (diagnostics && row.status === 'scanned') {
        if (row.rejectionReason) diagnostics.rejected[row.rejectionReason] = (diagnostics.rejected[row.rejectionReason] ?? 0) + 1;
        if (row.matches.length) diagnostics.strictMatches++;
        if (row.developing?.length) diagnostics.developingSetups++;
      }
      if (row.matches.length || row.developing?.length) rows.push(row);
    }
    const next = batch[batch.length - 1].ticker;
    if (next <= cursor) throw new Error('Pattern history pagination did not advance');
    cursor = next;
  }
  if (!coverage.total) throw new Error('No symbol metadata available for market');
  return { rows, coverage, updatedAt: new Date().toISOString(), durationSeconds: Math.round((Date.now()-started)/1000), ...(diagnostics ? { diagnostics } : {}) };
}

// Uses the same leases as the Python/GitHub worker. Concurrent button clicks,
// status recovery, and scheduled workers cannot process the same job twice.
export async function claimPatternRequest(): Promise<Job | null> {
  const db = await createServiceClient();
  const { data, error } = await db.rpc('claim_pattern_scan', {}).abortSignal(AbortSignal.timeout(15_000));
  if (error) throw error;
  return data as Job | null;
}

export async function processPatternRequests(initialJob?: Job) {
  const db = await createServiceClient();
  const deadline = Date.now() + 240_000;
  let completed = 0;
  let failed = 0;
  for (let index = 0; index < 6 && Date.now() < deadline - 30_000; index++) {
    const job = index === 0 && initialJob ? initialJob : await claimPatternRequest();
    if (!job) break;
    try {
      const result = await scanJob(db, job, deadline);
      const saved = await db.rpc('finish_pattern_scan', { p_job_id: job.id, p_lease_id: job.leaseId, p_result: result }).abortSignal(AbortSignal.timeout(15_000));
      if (saved.error) throw saved.error;
      if (!saved.data) throw new Error('Pattern worker lease lost');
      completed++;
    } catch (error) {
      console.error('In-app pattern search failed', job.id, error);
      failed++;
      const saved = await db.rpc('finish_pattern_scan', { p_job_id: job.id, p_lease_id: job.leaseId, p_result: null }).abortSignal(AbortSignal.timeout(15_000));
      if (saved.error) throw saved.error;
    }
  }
  return { completed, failed };
}
