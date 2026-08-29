import type {
  DiscoveryGoal,
  ScreenerFilterAvailability,
  ScreenerPayload,
  ScreenerRule,
} from "@/lib/screener-types";

export const DISCOVERY_GOALS: DiscoveryGoal[] = [
  "trend_leaders",
  "confirmed_breakout",
  "healthy_pullback",
  "stable_trend",
  "aggressive_rebound",
];

const GOAL_RULES: Record<DiscoveryGoal, ScreenerRule[]> = {
  trend_leaders: [
    { id: "goal-leaders-close", timeframe: "1D", field: "close", operator: "gte", value: 5 },
    { id: "goal-leaders-d50", timeframe: "1D", field: "is_above_sma50", operator: "is_true" },
    { id: "goal-leaders-d150", timeframe: "1D", field: "is_above_sma150", operator: "is_true" },
    { id: "goal-leaders-d200", timeframe: "1D", field: "is_above_sma200", operator: "is_true" },
    { id: "goal-leaders-w200", timeframe: "1W", field: "is_above_sma200", operator: "is_true" },
  ],
  confirmed_breakout: [
    { id: "goal-breakout-close", timeframe: "1D", field: "close", operator: "gte", value: 5 },
    { id: "goal-breakout-d50", timeframe: "1D", field: "is_above_sma50", operator: "is_true" },
    { id: "goal-breakout-high", timeframe: "1D", field: "is_new_high_50", operator: "is_true" },
  ],
  healthy_pullback: [
    { id: "goal-pullback-close", timeframe: "1D", field: "close", operator: "gte", value: 5 },
    { id: "goal-pullback-below20", timeframe: "1D", field: "is_below_sma20", operator: "is_true" },
    { id: "goal-pullback-d50", timeframe: "1D", field: "is_above_sma50", operator: "is_true" },
    { id: "goal-pullback-d200", timeframe: "1D", field: "is_above_sma200", operator: "is_true" },
    { id: "goal-pullback-w200", timeframe: "1W", field: "is_above_sma200", operator: "is_true" },
  ],
  stable_trend: [
    { id: "goal-stable-close", timeframe: "1D", field: "close", operator: "gte", value: 5 },
    { id: "goal-stable-d50", timeframe: "1D", field: "is_above_sma50", operator: "is_true" },
    { id: "goal-stable-d200", timeframe: "1D", field: "is_above_sma200", operator: "is_true" },
    { id: "goal-stable-w200", timeframe: "1W", field: "is_above_sma200", operator: "is_true" },
    { id: "goal-stable-atr", timeframe: "1D", field: "atr_percent", operator: "lt", value: 5 },
  ],
  aggressive_rebound: [
    { id: "goal-rebound-close", timeframe: "1D", field: "close", operator: "gte", value: 5 },
    { id: "goal-rebound-rsi", timeframe: "1D", field: "rsi_14", operator: "lte", value: 40 },
    { id: "goal-rebound-up", timeframe: "1D", field: "is_up_day", operator: "is_true" },
  ],
};

export function buildDiscoveryPayload(
  goal: DiscoveryGoal,
  current: ScreenerPayload
): ScreenerPayload {
  return {
    version: 1,
    discovery_goal: goal,
    listing_market: current.listing_market,
    market_cap_gte: current.market_cap_gte,
    market_cap_lte: current.market_cap_lte,
    rules: GOAL_RULES[goal].map((rule) => ({ ...rule })),
  };
}

export function discoveryGoalAvailable(
  goal: DiscoveryGoal,
  availability: ScreenerFilterAvailability | null
): boolean {
  if (!availability) return true;
  return GOAL_RULES[goal].every(
    (rule) => availability[rule.timeframe]?.[rule.field] ?? true
  );
}
