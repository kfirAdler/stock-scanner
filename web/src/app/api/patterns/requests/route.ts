import { after, NextRequest, NextResponse } from 'next/server';
import { authorizePatternRequest } from '@/lib/patterns/request-access';
import { createServiceClient } from '@/lib/supabase/server';
import type { PatternRequestStatus } from '@/lib/patterns/request-types';

import { claimPatternRequest, processPatternRequests } from '@/lib/patterns/worker';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function startQueuedWork(state: PatternRequestStatus) {
  if (state.job?.status !== 'queued') return;
  // Claim before acknowledging startup, so failures reach the UI immediately.
  const job = await claimPatternRequest();
  if (!job) return;
  if (state.job.id === job.id) state.job.status = 'running';
  after(async () => {
    try { await processPatternRequests(job); }
    catch (error) { console.error('Could not start pattern worker', error); }
  });
}

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  try {
    const gate = await authorizePatternRequest();
    if (gate.response) return gate.response;
    const db = await createServiceClient();
    const { data, error } = await db.rpc('pattern_scan_request_status', { p_user_id: gate.userId });
    if (error) throw error;
    // Recover previously queued work when the requester returns to the page.
    await startQueuedWork(data as PatternRequestStatus);
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('Pattern request status unavailable', error);
    return NextResponse.json({ code: 'REQUESTS_UNAVAILABLE' }, { status: 503, headers });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await authorizePatternRequest();
    if (gate.response) return gate.response;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !['ascending_triangle', 'channel', 'cup_and_handle'].includes(body.pattern)
      || !['US', 'TA'].includes(body.market)) {
      return NextResponse.json({ code: 'INVALID_QUERY' }, { status: 400, headers });
    }
    const db = await createServiceClient();
    const { data, error } = await db.rpc('request_pattern_scan', {
      p_user_id: gate.userId, p_pattern: body.pattern, p_market: body.market,
    });
    if (error) throw error;
    const state = data as PatternRequestStatus;
    await startQueuedWork(state);
    if (!state.accepted) {
      const retryAfter = Math.max(1, Math.ceil((Date.parse(state.nextAllowedAt!) - Date.parse(state.serverTime)) / 1000));
      return NextResponse.json(state, { status: 429, headers: { ...headers, 'Retry-After': String(retryAfter) } });
    }
    return NextResponse.json(state, { status: state.job?.status === 'completed' ? 200 : 202, headers });
  } catch (error) {
    console.error('Pattern request failed', error);
    return NextResponse.json({ code: 'REQUESTS_UNAVAILABLE' }, { status: 503, headers });
  }
}
