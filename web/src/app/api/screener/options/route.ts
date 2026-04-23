import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
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
      "pct_to_bb_upper_lte", "pct_to_bb_lower_lte",
      "down_sequence_broke_recently", "up_sequence_broke_recently",
      "down_sequence_broke_in_strong_up_context",
      "atr_percent_lt", "atr_percent_gt",
    ],
  });
}
