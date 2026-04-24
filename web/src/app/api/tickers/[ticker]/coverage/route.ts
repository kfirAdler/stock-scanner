import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildStockLookupCoverage } from "@/lib/stock-search-coverage";
import type { SnapshotRow } from "@/lib/screener-types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const supabase = await createServiceClient();

  const [snapRes, countRes] = await Promise.all([
    supabase
      .from("symbol_indicator_snapshot")
      .select("*")
      .eq("ticker", upper)
      .eq("timeframe", "1D")
      .maybeSingle(),
    supabase
      .from("market_raw_data")
      .select("ticker", { count: "exact", head: true })
      .eq("ticker", upper),
  ]);

  if (snapRes.error) {
    return NextResponse.json({ error: snapRes.error.message }, { status: 500 });
  }

  if (!snapRes.data) {
    return NextResponse.json(
      { error: "Ticker not found", ticker: upper },
      { status: 404 }
    );
  }

  const row = snapRes.data as SnapshotRow;
  const barCount = countRes.count ?? 0;
  const { indicators, screenerFilters } = buildStockLookupCoverage(row, barCount);

  return NextResponse.json({
    ticker: upper,
    market: row.market ?? "US",
    barCount,
    snapshot: {
      close: row.close,
      last_trade_date: row.last_trade_date,
    },
    indicators,
    screenerFilters,
  });
}
