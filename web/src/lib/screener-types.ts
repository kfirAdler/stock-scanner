export interface ScreenerFilters {
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

  down_sequence_broke_recently?: boolean;
  up_sequence_broke_recently?: boolean;
  down_sequence_broke_in_strong_up_context?: boolean;

  atr_percent_lt?: number;
  atr_percent_gt?: number;
}

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
  /** Bars from latest bar to the bar where strong buy last fired (0 = last bar). */
  strong_buy_signal_bars_ago?: number | null;
  strong_sell_signal_bars_ago?: number | null;
  is_above_sma20: boolean | null;
  is_below_sma20: boolean | null;
  is_above_sma50: boolean | null;
  is_below_sma50: boolean | null;
  is_above_sma150: boolean | null;
  is_below_sma150: boolean | null;
  is_above_sma200: boolean | null;
  is_below_sma200: boolean | null;
  updated_at: string;
}
