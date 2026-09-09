import { NextResponse } from 'next/server';

// Pattern discovery is informational. Only the scheduled worker starts scans.
export function GET() {
  return NextResponse.json({ code: 'MANUAL_SEARCH_DISABLED' }, { status: 410 });
}
export const POST = GET;
