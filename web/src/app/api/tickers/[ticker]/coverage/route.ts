import { NextRequest, NextResponse } from "next/server";
import { assertFullMarketDataAccess } from "@/lib/market-access";
import { createServiceClient } from "@/lib/supabase/server";
import { buildStockLookupCoverage } from "@/lib/stock-search-coverage";
import type { ScreenerTimeframe, SnapshotRow } from "@/lib/screener-types";

const SNAPSHOT_SELECT = [
  "ticker",
  "timeframe",
  "last_trade_date",
  "close",
  "sma_20",
  "sma_50",
  "sma_150",
  "sma_200",
  "ema_20",
  "bb_upper_20_2",
  "bb_lower_20_2",
  "pct_to_bb_upper",
  "pct_to_bb_lower",
  "atr_14",
  "atr_percent",
  "bullish_sequence_active",
  "bearish_sequence_active",
  "strong_up_sequence_context",
  "strong_down_sequence_context",
  "up_sequence_count",
  "down_sequence_count",
  "up_sequence_break_bars_ago",
  "down_sequence_break_bars_ago",
  "up_sequence_broke_recently",
  "down_sequence_broke_recently",
  "down_sequence_broke_in_strong_up_context",
  "up_sequence_broke_in_strong_down_context",
  "buy_signal",
  "sell_signal",
  "strong_buy_signal",
  "strong_sell_signal",
  "strong_buy_signal_bars_ago",
  "strong_sell_signal_bars_ago",
  "fib_swing_side",
  "fib_swing_low",
  "fib_swing_high",
  "fib_level_382",
  "fib_level_500",
  "fib_level_618",
  "fib_level_786",
  "fib_zone_0_382",
  "fib_zone_382_500",
  "fib_zone_500_618",
  "fib_zone_618_786",
  "fib_zone_786_100",
  "is_above_sma20",
  "is_below_sma20",
  "is_above_sma50",
  "is_below_sma50",
  "is_above_sma150",
  "is_below_sma150",
  "is_above_sma200",
  "is_below_sma200",
  "updated_at",
  "market",
].join(",");

function groupSnapshotsByTimeframe(rows: SnapshotRow[]) {
  const grouped: Partial<Record<ScreenerTimeframe, SnapshotRow | null>> = {};
  for (const row of rows) {
    const timeframe = row.timeframe as ScreenerTimeframe;
    if (timeframe !== "1D" && timeframe !== "1W" && timeframe !== "1M") continue;
    grouped[timeframe] = row;
  }
  return grouped;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const gate = await assertFullMarketDataAccess();
  if (!gate.allowed) return gate.response;

  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const supabase = await createServiceClient();

  const [snapRes, countRes, timeframeRes, metaRes, recentBarsRes] = await Promise.all([
    supabase
      .from("symbol_indicator_snapshot")
      .select(SNAPSHOT_SELECT)
      .eq("ticker", upper)
      .eq("timeframe", "1D")
      .maybeSingle(),
    supabase
      .from("market_raw_data")
      .select("ticker", { count: "exact", head: true })
      .eq("ticker", upper),
    supabase
      .from("symbol_indicator_snapshot")
      .select(SNAPSHOT_SELECT)
      .eq("ticker", upper)
      .in("timeframe", ["1D", "1W", "1M"]),
    supabase
      .from("symbol_metadata")
      .select("company_name,sector,industry,market_cap")
      .eq("ticker", upper)
      .maybeSingle(),
    supabase
      .from("market_raw_data")
      .select("trade_date,close")
      .eq("ticker", upper)
      .order("trade_date", { ascending: false })
      .limit(60),
  ]);

  if (snapRes.error) {
    return NextResponse.json({ error: snapRes.error.message }, { status: 500 });
  }
  if (timeframeRes.error) {
    return NextResponse.json({ error: timeframeRes.error.message }, { status: 500 });
  }
  if (metaRes.error) {
    return NextResponse.json({ error: metaRes.error.message }, { status: 500 });
  }
  if (recentBarsRes.error) {
    return NextResponse.json({ error: recentBarsRes.error.message }, { status: 500 });
  }

  if (!snapRes.data) {
    return NextResponse.json(
      { error: "Ticker not found", ticker: upper },
      { status: 404 }
    );
  }

  const row = snapRes.data as unknown as SnapshotRow;
  const barCount = countRes.count ?? 0;
  const { indicators, screenerFilters } = buildStockLookupCoverage(row, barCount);
  const timeframeSnapshots = groupSnapshotsByTimeframe((timeframeRes.data ?? []) as unknown as SnapshotRow[]);

  return NextResponse.json({
    ticker: upper,
    market: row.market ?? "US",
    barCount,
    snapshot: {
      close: row.close,
      last_trade_date: row.last_trade_date,
    },
    dailySnapshot: row,
    timeframeSnapshots,
    recentBars: recentBarsRes.data ?? [],
    metadata: metaRes.data ?? null,
    indicators,
    screenerFilters,
  });
}
