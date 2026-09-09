import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEntitlement } from '@/lib/market-access';
import { loadPatterns, loadLastPatternAttempt } from '@/lib/patterns/data';

export async function GET(request: NextRequest) {
  try {
  const entitlement = await getCurrentEntitlement();
  if (!entitlement.loggedIn) return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  if (!entitlement.canUseScreener) return NextResponse.json({ code: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });
  const market = request.nextUrl.searchParams.get('market') ?? 'US';
  const ticker = request.nextUrl.searchParams.get('ticker')?.toUpperCase();
  if (!['US', 'TA'].includes(market) || (ticker !== undefined && !/^[A-Z0-9.^-]{1,24}$/.test(ticker))) {
    return NextResponse.json({ code: 'INVALID_QUERY' }, { status: 400 });
  }
    const snapshots = await loadPatterns(market as 'US' | 'TA', ticker);
    const rows = snapshots.map(row => ({ ...row, status: row.status === 'scanned' && (!row.as_of || Date.now() - Date.parse(row.as_of) > 7 * 86400000) ? 'stale' as const : row.status }));
    if (ticker) return NextResponse.json({ row: rows[0] ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
    const lastAttempt = await loadLastPatternAttempt().catch(() => null);
    return NextResponse.json({
      lastAttempt,
      rows: rows.filter(row => row.status === 'scanned' && row.matches.length > 0).map(({ candles, ...row }) => ({ ...row, preview: candles?.length ? { offset: 0, candles: candles.map(c => [c.open, c.high, c.low, c.close]) } : null })),
      coverage: { total: rows.length, scanned: rows.filter(r => r.status === 'scanned').length, stale: rows.filter(r => r.status === 'stale').length, insufficient: rows.filter(r => r.status === 'insufficient_history').length },
      updatedAt: rows.reduce<string | null>((latest, row) => !latest || row.updated_at > latest ? row.updated_at : latest, null),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Pattern snapshots unavailable', error);
    return NextResponse.json({ code: 'PATTERNS_UNAVAILABLE' }, { status: 503 });
  }
}
