import { NextRequest, NextResponse } from "next/server";
import { assertFullMarketDataAccess } from "@/lib/market-access";
import { createServiceClient } from "@/lib/supabase/server";
import { buildStockLookupCoverage } from "@/lib/stock-search-coverage";
import { loadPatternPeers } from "@/lib/patterns/data";
import { scanSeries } from "@/lib/patterns/engine/scan.mjs";
import { channelDirectionOf, type PatternMatch, type PatternCandle } from "@/lib/patterns/types";
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
      .select("company_name,sector,industry,market_cap,listing_exchange,return_on_equity,debt_to_equity")
      .eq("ticker", upper)
      .maybeSingle(),
    supabase
      .from("market_raw_data")
      .select("trade_date,open,high,low,close,volume")
      .eq("ticker", upper)
      .order("trade_date", { ascending: false })
      .limit(160),
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
  const recentBars = (recentBarsRes.data ?? []).filter((bar) => {
    const values = [bar.open, bar.high, bar.low, bar.close].map(Number);
    const [open, high, low, close] = values;
    return values.every((value) => Number.isFinite(value) && value > 0) &&
      high >= Math.max(open, close, low) && low <= Math.min(open, close);
  });
  const market = row.market === "TA" ? "TA" : "US";
  const candles: PatternCandle[] = recentBars.map((bar) => ({
    date: bar.trade_date,
    open: Number(bar.open),
    high: Number(bar.high),
    low: Number(bar.low),
    close: Number(bar.close),
  }));
  const analysis = scanSeries([{ ticker: upper, candles }])[0];
  const matches = (analysis?.matches ?? []).filter((match) => match.stage !== 'developing' && match.confidence >= 0.7)
    .sort((a, b) => b.confidence - a.confidence);
  let patternPeers: { ticker: string; companyName: string | null; confidence: number; asOf: string | null }[] = [];
  if (matches.length > 0) {
    try {
      const primary = matches[0];
      const rows = await loadPatternPeers(market);
      patternPeers = rows.flatMap((peer) => {
        if (peer.ticker === upper || !peer.as_of || Date.now() - Date.parse(peer.as_of) > 7 * 86400000) return [];
        const comparable = peer.matches.find((candidate: PatternMatch) => candidate.stage !== 'developing' &&
          candidate.pattern === primary.pattern &&
          (primary.pattern !== 'channel' || channelDirectionOf(candidate) === channelDirectionOf(primary)) &&
          Math.abs(candidate.confidence - primary.confidence) <= 0.050001);
        return comparable ? [{ ticker: peer.ticker, companyName: peer.company_name,
          confidence: comparable.confidence, asOf: peer.as_of }] : [];
      }).sort((a, b) => Math.abs(a.confidence - primary.confidence) - Math.abs(b.confidence - primary.confidence))
        .slice(0, 8);
    } catch (error) {
      console.error('Pattern peers unavailable', error);
    }
  }

  return NextResponse.json({
    ticker: upper,
    market,
    barCount,
    snapshot: {
      close: row.close,
      last_trade_date: row.last_trade_date,
    },
    dailySnapshot: row,
    timeframeSnapshots,
    recentBars,
    patterns: { asOf: analysis?.as_of ?? null, matches, peers: patternPeers },
    metadata: metaRes.data ?? null,
    indicators,
    screenerFilters,
  });
}
