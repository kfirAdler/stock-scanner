import type {
  DiscoveryGoal,
  DiscoveryReasonCode,
  DiscoveryRiskCode,
  ScannerResultSnapshot,
  ScreenerResultRow,
} from "@/lib/screener-types";

function addUnique<T>(items: T[], value: T, limit: number) {
  if (items.length < limit && !items.includes(value)) items.push(value);
}

export function buildDiscoveryEvidence(
  goal: DiscoveryGoal | undefined,
  row: ScreenerResultRow
): Pick<ScreenerResultRow, "match_reasons" | "risk_flags"> {
  const reasons: DiscoveryReasonCode[] = [];
  const risks: DiscoveryRiskCode[] = [];
  const weekly = row.timeframe_snapshots?.["1W"] as ScannerResultSnapshot | null | undefined;
  const monthly = row.timeframe_snapshots?.["1M"] as ScannerResultSnapshot | null | undefined;
  const dailyTrend = !!(row.is_above_sma50 && row.is_above_sma150 && row.is_above_sma200);
  const higherTrend = !!(weekly?.is_above_sma200 || monthly?.is_above_sma200);
  const volumeConfirmed = !!(
    row.is_up_day &&
    row.relative_volume_20 != null &&
    row.relative_volume_20 >= 1.5
  );
  const controlledPullback = !!(
    row.is_below_sma20 && row.is_above_sma50 && row.is_above_sma200
  );
  const reversalConfirmed = !!(
    row.buy_signal || row.strong_buy_signal || row.down_sequence_broke_recently
  );
  const oversoldTurn = !!(row.is_up_day && row.rsi_14 != null && row.rsi_14 <= 40);
  const lowerVolatility = row.atr_percent != null && row.atr_percent <= 3;
  const basicFinancialHealth = !!(
    row.return_on_equity != null &&
    row.return_on_equity > 0 &&
    row.debt_to_equity != null &&
    row.debt_to_equity >= 0 &&
    row.debt_to_equity < 1.5
  );

  if (goal === "confirmed_breakout") {
    if (row.is_new_high_50) addUnique(reasons, "new_high_50", 3);
    if (volumeConfirmed) addUnique(reasons, "volume_confirmation", 3);
    if (dailyTrend) addUnique(reasons, "daily_trend", 3);
    if (higherTrend) addUnique(reasons, "higher_timeframe_trend", 3);
  } else if (goal === "healthy_pullback") {
    if (controlledPullback) addUnique(reasons, "controlled_pullback", 3);
    if (higherTrend) addUnique(reasons, "higher_timeframe_trend", 3);
    if (reversalConfirmed) addUnique(reasons, "reversal_confirmed", 3);
    if (dailyTrend) addUnique(reasons, "daily_trend", 3);
  } else if (goal === "stable_trend") {
    if (lowerVolatility) addUnique(reasons, "lower_volatility", 3);
    if (dailyTrend) addUnique(reasons, "daily_trend", 3);
    if (higherTrend) addUnique(reasons, "higher_timeframe_trend", 3);
    if (basicFinancialHealth) addUnique(reasons, "basic_financial_health", 3);
  } else if (goal === "aggressive_rebound") {
    if (oversoldTurn) addUnique(reasons, "oversold_turn", 3);
    if (reversalConfirmed) addUnique(reasons, "reversal_confirmed", 3);
    if (volumeConfirmed) addUnique(reasons, "volume_confirmation", 3);
    if (higherTrend) addUnique(reasons, "higher_timeframe_trend", 3);
  } else {
    if (dailyTrend) addUnique(reasons, "daily_trend", 3);
    if (higherTrend) addUnique(reasons, "higher_timeframe_trend", 3);
    if (basicFinancialHealth) addUnique(reasons, "basic_financial_health", 3);
    if (row.is_new_high_50) addUnique(reasons, "new_high_50", 3);
  }

  if (row.atr_percent != null && row.atr_percent >= 6) {
    risks.push("high_volatility");
  } else if (row.rsi_14 != null && row.rsi_14 >= 80) {
    risks.push("elevated_rsi");
  } else if (
    goal === "confirmed_breakout" &&
    row.relative_volume_20 != null &&
    row.relative_volume_20 < 1
  ) {
    risks.push("weak_volume");
  } else if (row.debt_to_equity != null && row.debt_to_equity < 0) {
    risks.push("negative_equity");
  }

  return { match_reasons: reasons, risk_flags: risks };
}
