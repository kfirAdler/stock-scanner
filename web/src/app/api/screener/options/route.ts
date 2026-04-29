import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
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
      "close",
      "up_sequence_count", "down_sequence_count",
      "up_sequence_break_bars_ago", "down_sequence_break_bars_ago",
      "fib_zone",
    ],
  });
}
