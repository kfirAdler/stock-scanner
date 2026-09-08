import { NextRequest, NextResponse } from 'next/server';
import { authorizePatternRequest } from '@/lib/patterns/request-access';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const gate = await authorizePatternRequest();
    if (gate.response) return gate.response;
    const jobId = request.nextUrl.searchParams.get('jobId') ?? '';
    const ticker = request.nextUrl.searchParams.get('ticker') ?? '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)
      || !/^[A-Z0-9.^-]{1,24}$/.test(ticker)) return NextResponse.json({ code: 'INVALID_QUERY' }, { status: 400, headers });
    const db = await createServiceClient();
    const { data, error } = await db.rpc('pattern_scan_detail', { p_user_id: gate.userId, p_job_id: jobId, p_ticker: ticker });
    if (error) throw error;
    if (!data) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404, headers });
    const row = { ...data, status: !data.as_of || Date.now() - Date.parse(data.as_of) > 7 * 86400000 ? 'stale' : data.status };
    return NextResponse.json({ row }, { headers });
  } catch (error) {
    console.error('Requested pattern chart unavailable', error);
    return NextResponse.json({ code: 'REQUESTS_UNAVAILABLE' }, { status: 503, headers });
  }
}
