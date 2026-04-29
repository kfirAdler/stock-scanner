export type ListingMarketFilter = "US" | "TA";
export type ScreenerTimeframe = "1D" | "1W" | "1M";

export type ScreenerRuleField =
  | "is_above_sma20"
  | "is_below_sma20"
  | "is_above_sma50"
  | "is_below_sma50"
  | "is_above_sma150"
  | "is_below_sma150"
  | "is_above_sma200"
  | "is_below_sma200"
  | "down_sequence_broke_recently"
  | "up_sequence_broke_recently"
  | "down_sequence_broke_in_strong_up_context"
  | "up_sequence_broke_in_strong_down_context"
  | "buy_signal"
  | "sell_signal"
  | "strong_buy_signal"
  | "strong_sell_signal"
  | "bullish_sequence_active"
  | "bearish_sequence_active"
  | "strong_up_sequence_context"
  | "strong_down_sequence_context"
  | "pct_to_bb_upper"
  | "pct_to_bb_lower"
  | "atr_percent"
  | "atr_14"
  | "close"
  | "up_sequence_count"
  | "down_sequence_count"
  | "up_sequence_break_bars_ago"
  | "down_sequence_break_bars_ago"
  | "fib_zone";

export type ScreenerRuleOperator =
  | "is_true"
  | "lte"
  | "gte"
  | "lt"
  | "gt"
  | "eq";

export interface ScreenerRule {
  id: string;
  timeframe: ScreenerTimeframe;
  field: ScreenerRuleField;
  operator: ScreenerRuleOperator;
  value?: string | number | boolean;
}

export interface ScreenerPayload {
  version: 1;
  listing_market?: ListingMarketFilter;
  market_cap_gte?: number;
  market_cap_lte?: number;
  rules: ScreenerRule[];
}

export type LegacyScreenerFilters = {
  listing_market?: ListingMarketFilter;
  is_above_sma20?: boolean;
  is_below_sma20?: boolean;
  is_above_sma50?: boolean;
  is_below_sma50?: boolean;
  is_above_sma150?: boolean;
  is_below_sma150?: boolean;
  is_above_sma200?: boolean;
  is_below_sma200?: boolean;
  pct_to_bb_upper_lte?: number;
  pct_to_bb_lower_lte?: number;
  pct_to_bb_upper_gte?: number;
  pct_to_bb_lower_gte?: number;
  down_sequence_broke_recently?: boolean;
  up_sequence_broke_recently?: boolean;
  down_sequence_broke_in_strong_up_context?: boolean;
  up_sequence_broke_in_strong_down_context?: boolean;
  buy_signal?: boolean;
  sell_signal?: boolean;
  strong_buy_signal?: boolean;
  strong_sell_signal?: boolean;
  bullish_sequence_active?: boolean;
  bearish_sequence_active?: boolean;
  strong_up_sequence_context?: boolean;
  strong_down_sequence_context?: boolean;
  atr_percent_lt?: number;
  atr_percent_gt?: number;
  atr_14_lt?: number;
  atr_14_gt?: number;
  close_gte?: number;
  close_lte?: number;
  up_sequence_count_gte?: number;
  down_sequence_count_gte?: number;
  up_sequence_break_bars_ago_lte?: number;
  down_sequence_break_bars_ago_lte?: number;
};

export interface SnapshotRow {
  ticker: string;
  timeframe: string;
  last_trade_date: string;
  close: number;
  sma_20: number | null;
  sma_50: number | null;
  sma_150: number | null;
  sma_200: number | null;
  ema_20: number | null;
  bb_upper_20_2: number | null;
  bb_lower_20_2: number | null;
  pct_to_bb_upper: number | null;
  pct_to_bb_lower: number | null;
  atr_14: number | null;
  atr_percent: number | null;
  bullish_sequence_active: boolean;
  bearish_sequence_active: boolean;
  strong_up_sequence_context: boolean;
  strong_down_sequence_context: boolean;
  up_sequence_count: number;
  down_sequence_count: number;
  up_sequence_break_bars_ago: number | null;
  down_sequence_break_bars_ago: number | null;
  up_sequence_broke_recently: boolean;
  down_sequence_broke_recently: boolean;
  down_sequence_broke_in_strong_up_context: boolean;
  up_sequence_broke_in_strong_down_context: boolean;
  buy_signal: boolean;
  sell_signal: boolean;
  strong_buy_signal: boolean;
  strong_sell_signal: boolean;
  strong_buy_signal_bars_ago?: number | null;
  strong_sell_signal_bars_ago?: number | null;
  fib_swing_side?: string | null;
  fib_swing_low?: number | null;
  fib_swing_high?: number | null;
  fib_level_382?: number | null;
  fib_level_500?: number | null;
  fib_level_618?: number | null;
  fib_level_786?: number | null;
  fib_zone_0_382?: boolean;
  fib_zone_382_500?: boolean;
  fib_zone_500_618?: boolean;
  fib_zone_618_786?: boolean;
  fib_zone_786_100?: boolean;
  is_above_sma20: boolean | null;
  is_below_sma20: boolean | null;
  is_above_sma50: boolean | null;
  is_below_sma50: boolean | null;
  is_above_sma150: boolean | null;
  is_below_sma150: boolean | null;
  is_above_sma200: boolean | null;
  is_below_sma200: boolean | null;
  updated_at: string;
  market?: string;
}

export interface ScreenerResultRow extends SnapshotRow {
  matched_timeframes?: ScreenerTimeframe[];
}
