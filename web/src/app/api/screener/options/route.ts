import { NextResponse } from "next/server";
import type {
  ScreenerFilterAvailability,
  ScreenerRuleField,
  ScreenerTimeframe,
} from "@/lib/screener-types";
import { createServiceClient } from "@/lib/supabase/server";

type SnapshotAvailabilityRow = {
  timeframe: ScreenerTimeframe;
  close: number | null;
  pct_to_bb_upper: number | null;
  pct_to_bb_lower: number | null;
  atr_14: number | null;
  atr_percent: number | null;
  rsi_14: number | null;
  avg_volume_20: number | null;
  relative_volume_20: number | null;
  is_new_high_50: boolean | null;
  up_sequence_break_bars_ago: number | null;
  down_sequence_break_bars_ago: number | null;
  is_above_sma20: boolean | null;
  is_below_sma20: boolean | null;
  is_above_sma50: boolean | null;
  is_below_sma50: boolean | null;
  is_above_sma150: boolean | null;
  is_below_sma150: boolean | null;
  is_above_sma200: boolean | null;
  is_below_sma200: boolean | null;
  buy_signal: boolean | null;
  sell_signal: boolean | null;
  strong_buy_signal: boolean | null;
  strong_sell_signal: boolean | null;
  bullish_sequence_active: boolean | null;
  bearish_sequence_active: boolean | null;
  strong_up_sequence_context: boolean | null;
  strong_down_sequence_context: boolean | null;
  down_sequence_broke_recently: boolean | null;
  up_sequence_broke_recently: boolean | null;
  down_sequence_broke_in_strong_up_context: boolean | null;
  up_sequence_broke_in_strong_down_context: boolean | null;
  is_up_day: boolean | null;
  up_sequence_count: number | null;
  down_sequence_count: number | null;
  fib_zone_0_382: boolean | null;
};

const SNAPSHOT_SELECT = [
  "timeframe",
  "close",
  "pct_to_bb_upper",
  "pct_to_bb_lower",
  "atr_14",
  "atr_percent",
  "rsi_14",
  "avg_volume_20",
  "relative_volume_20",
  "is_new_high_50",
  "up_sequence_break_bars_ago",
  "down_sequence_break_bars_ago",
  "is_above_sma20",
  "is_below_sma20",
  "is_above_sma50",
  "is_below_sma50",
  "is_above_sma150",
  "is_below_sma150",
  "is_above_sma200",
  "is_below_sma200",
  "buy_signal",
  "sell_signal",
  "strong_buy_signal",
  "strong_sell_signal",
  "bullish_sequence_active",
  "bearish_sequence_active",
  "strong_up_sequence_context",
  "strong_down_sequence_context",
  "down_sequence_broke_recently",
  "up_sequence_broke_recently",
  "down_sequence_broke_in_strong_up_context",
  "up_sequence_broke_in_strong_down_context",
  "is_up_day",
  "up_sequence_count",
  "down_sequence_count",
  "fib_zone_0_382",
].join(",");

function hasAnyNonNull<Row extends Record<string, unknown>>(rows: Row[], key: keyof Row) {
  return rows.some((row) => row[key] !== null && row[key] !== undefined);
}

function buildAvailability(
  snapshotRows: SnapshotAvailabilityRow[],
  metadataRows: Array<Record<string, unknown>>
): ScreenerFilterAvailability {
  const timeframes: ScreenerTimeframe[] = ["1D", "1W", "1M"];
  const metadataAvailable = {
    return_on_equity: hasAnyNonNull(metadataRows, "return_on_equity"),
    debt_to_equity: hasAnyNonNull(metadataRows, "debt_to_equity"),
  };

  const availability: ScreenerFilterAvailability = {};

  for (const timeframe of timeframes) {
    const rows = snapshotRows.filter((row) => row.timeframe === timeframe);
    const baseAvailable = rows.length > 0;

    availability[timeframe] = {
      close: hasAnyNonNull(rows, "close"),
      pct_to_bb_upper: hasAnyNonNull(rows, "pct_to_bb_upper"),
      pct_to_bb_lower: hasAnyNonNull(rows, "pct_to_bb_lower"),
      atr_14: hasAnyNonNull(rows, "atr_14"),
      atr_percent: hasAnyNonNull(rows, "atr_percent"),
      rsi_14: hasAnyNonNull(rows, "rsi_14"),
      avg_volume_20: hasAnyNonNull(rows, "avg_volume_20"),
      relative_volume_20: hasAnyNonNull(rows, "relative_volume_20"),
      is_new_high_50: hasAnyNonNull(rows, "is_new_high_50"),
      up_sequence_break_bars_ago: hasAnyNonNull(rows, "up_sequence_break_bars_ago"),
      down_sequence_break_bars_ago: hasAnyNonNull(rows, "down_sequence_break_bars_ago"),
      is_above_sma20: hasAnyNonNull(rows, "is_above_sma20"),
      is_below_sma20: hasAnyNonNull(rows, "is_below_sma20"),
      is_above_sma50: hasAnyNonNull(rows, "is_above_sma50"),
      is_below_sma50: hasAnyNonNull(rows, "is_below_sma50"),
      is_above_sma150: hasAnyNonNull(rows, "is_above_sma150"),
      is_below_sma150: hasAnyNonNull(rows, "is_below_sma150"),
      is_above_sma200: hasAnyNonNull(rows, "is_above_sma200"),
      is_below_sma200: hasAnyNonNull(rows, "is_below_sma200"),
      buy_signal: hasAnyNonNull(rows, "buy_signal"),
      sell_signal: hasAnyNonNull(rows, "sell_signal"),
      strong_buy_signal: hasAnyNonNull(rows, "strong_buy_signal"),
      strong_sell_signal: hasAnyNonNull(rows, "strong_sell_signal"),
      bullish_sequence_active: hasAnyNonNull(rows, "bullish_sequence_active"),
      bearish_sequence_active: hasAnyNonNull(rows, "bearish_sequence_active"),
      strong_up_sequence_context: hasAnyNonNull(rows, "strong_up_sequence_context"),
      strong_down_sequence_context: hasAnyNonNull(rows, "strong_down_sequence_context"),
      down_sequence_broke_recently: hasAnyNonNull(rows, "down_sequence_broke_recently"),
      up_sequence_broke_recently: hasAnyNonNull(rows, "up_sequence_broke_recently"),
      down_sequence_broke_in_strong_up_context: hasAnyNonNull(rows, "down_sequence_broke_in_strong_up_context"),
      up_sequence_broke_in_strong_down_context: hasAnyNonNull(rows, "up_sequence_broke_in_strong_down_context"),
      is_up_day: hasAnyNonNull(rows, "is_up_day"),
      up_sequence_count: hasAnyNonNull(rows, "up_sequence_count"),
      down_sequence_count: hasAnyNonNull(rows, "down_sequence_count"),
      fib_zone: hasAnyNonNull(rows, "fib_zone_0_382"),
      return_on_equity: baseAvailable && metadataAvailable.return_on_equity,
      debt_to_equity: baseAvailable && metadataAvailable.debt_to_equity,
    };
  }

  return availability;
}

export async function GET() {
  const supabase = await createServiceClient();
  const [
    { data: dailyData },
    { data: weeklyData },
    { data: monthlyData },
    { data: metadataData },
  ] = await Promise.all([
    supabase.from("symbol_indicator_snapshot").select(SNAPSHOT_SELECT).eq("timeframe", "1D"),
    supabase.from("symbol_indicator_snapshot").select(SNAPSHOT_SELECT).eq("timeframe", "1W"),
    supabase.from("symbol_indicator_snapshot").select(SNAPSHOT_SELECT).eq("timeframe", "1M"),
    supabase.from("symbol_metadata").select("return_on_equity,debt_to_equity"),
  ]);

  const filterAvailability = buildAvailability(
    [
      ...((dailyData ?? []) as unknown as SnapshotAvailabilityRow[]),
      ...((weeklyData ?? []) as unknown as SnapshotAvailabilityRow[]),
      ...((monthlyData ?? []) as unknown as SnapshotAvailabilityRow[]),
    ],
    (metadataData ?? []) as Array<Record<string, unknown>>
  );

  return NextResponse.json(
    {
      timeframes: ["1D", "1W", "1M"],
      sma_lengths: [20, 50, 150, 200],
      bollinger: {
        period: 20,
        std_dev: 2,
        proximity_threshold: 2,
      },
      atr_period: 14,
      sequence_recent_threshold: 2,
      supported_filters: [
        "is_above_sma20", "is_below_sma20",
        "is_above_sma50", "is_below_sma50",
        "is_above_sma150", "is_below_sma150",
        "is_above_sma200", "is_below_sma200",
        "pct_to_bb_upper", "pct_to_bb_lower",
        "down_sequence_broke_recently", "up_sequence_broke_recently",
        "down_sequence_broke_in_strong_up_context",
        "up_sequence_broke_in_strong_down_context",
        "buy_signal", "sell_signal",
        "strong_buy_signal", "strong_sell_signal",
        "bullish_sequence_active", "bearish_sequence_active",
        "strong_up_sequence_context", "strong_down_sequence_context",
        "atr_percent", "atr_14",
        "rsi_14", "avg_volume_20", "relative_volume_20",
        "is_up_day", "is_new_high_50",
        "close",
        "return_on_equity", "debt_to_equity",
        "up_sequence_count", "down_sequence_count",
        "up_sequence_break_bars_ago", "down_sequence_break_bars_ago",
        "fib_zone",
      ] satisfies ScreenerRuleField[],
      filterAvailability,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
