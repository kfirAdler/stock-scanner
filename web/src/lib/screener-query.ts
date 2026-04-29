import type {
  LegacyScreenerFilters,
  ScreenerPayload,
  ScreenerRule,
  ScreenerRuleField,
  ScreenerTimeframe,
} from "@/lib/screener-types";

export const SCREENER_BOOLEAN_FILTER_KEYS: (keyof LegacyScreenerFilters)[] = [
  "is_above_sma20",
  "is_below_sma20",
  "is_above_sma50",
  "is_below_sma50",
  "is_above_sma150",
  "is_below_sma150",
  "is_above_sma200",
  "is_below_sma200",
  "down_sequence_broke_recently",
  "up_sequence_broke_recently",
  "down_sequence_broke_in_strong_up_context",
  "up_sequence_broke_in_strong_down_context",
  "buy_signal",
  "sell_signal",
  "strong_buy_signal",
  "strong_sell_signal",
  "bullish_sequence_active",
  "bearish_sequence_active",
  "strong_up_sequence_context",
  "strong_down_sequence_context",
];

export const SCREENER_NUMERIC_FILTER_KEYS: (keyof LegacyScreenerFilters)[] = [
  "pct_to_bb_upper_lte",
  "pct_to_bb_upper_gte",
  "pct_to_bb_lower_lte",
  "pct_to_bb_lower_gte",
  "atr_percent_lt",
  "atr_percent_gt",
  "atr_14_lt",
  "atr_14_gt",
  "close_gte",
  "close_lte",
  "up_sequence_count_gte",
  "down_sequence_count_gte",
  "up_sequence_break_bars_ago_lte",
  "down_sequence_break_bars_ago_lte",
];

export type TvStudySpec = {
  id: string;
  inputs?: Record<string, number | string>;
};

export const DEFAULT_SCREENER_PAYLOAD: ScreenerPayload = {
  version: 1,
  rules: [],
};

export type RuleDefinition = {
  field: ScreenerRuleField;
  labelKey: string;
  category: "sequence" | "signals" | "trend" | "location" | "volatility";
  descriptionKey?: string;
  operators: string[];
  input: "none" | "number" | "select";
  valueOptions?: { value: string; labelKey: string }[];
};

export const RULE_DEFINITIONS: RuleDefinition[] = [
  { field: "is_above_sma20", labelKey: "rules.is_above_sma20", category: "trend", operators: ["is_true"], input: "none" },
  { field: "is_below_sma20", labelKey: "rules.is_below_sma20", category: "trend", operators: ["is_true"], input: "none" },
  { field: "is_above_sma50", labelKey: "rules.is_above_sma50", category: "trend", operators: ["is_true"], input: "none" },
  { field: "is_below_sma50", labelKey: "rules.is_below_sma50", category: "trend", operators: ["is_true"], input: "none" },
  { field: "is_above_sma150", labelKey: "rules.is_above_sma150", category: "trend", operators: ["is_true"], input: "none" },
  { field: "is_below_sma150", labelKey: "rules.is_below_sma150", category: "trend", operators: ["is_true"], input: "none" },
  { field: "is_above_sma200", labelKey: "rules.is_above_sma200", category: "trend", operators: ["is_true"], input: "none" },
  { field: "is_below_sma200", labelKey: "rules.is_below_sma200", category: "trend", operators: ["is_true"], input: "none" },
  { field: "buy_signal", labelKey: "rules.buy_signal", category: "signals", descriptionKey: "tooltips.buy_signal", operators: ["is_true"], input: "none" },
  { field: "sell_signal", labelKey: "rules.sell_signal", category: "signals", descriptionKey: "tooltips.sell_signal", operators: ["is_true"], input: "none" },
  { field: "strong_buy_signal", labelKey: "rules.strong_buy_signal", category: "signals", descriptionKey: "tooltips.strong_buy_signal", operators: ["is_true"], input: "none" },
  { field: "strong_sell_signal", labelKey: "rules.strong_sell_signal", category: "signals", descriptionKey: "tooltips.strong_sell_signal", operators: ["is_true"], input: "none" },
  { field: "bullish_sequence_active", labelKey: "rules.bullish_sequence_active", category: "sequence", descriptionKey: "tooltips.bullish_sequence_active", operators: ["is_true"], input: "none" },
  { field: "bearish_sequence_active", labelKey: "rules.bearish_sequence_active", category: "sequence", descriptionKey: "tooltips.bearish_sequence_active", operators: ["is_true"], input: "none" },
  { field: "strong_up_sequence_context", labelKey: "rules.strong_up_sequence_context", category: "sequence", operators: ["is_true"], input: "none" },
  { field: "strong_down_sequence_context", labelKey: "rules.strong_down_sequence_context", category: "sequence", operators: ["is_true"], input: "none" },
  { field: "down_sequence_broke_recently", labelKey: "rules.down_sequence_broke_recently", category: "sequence", descriptionKey: "tooltips.down_sequence_broke_recently", operators: ["is_true"], input: "none" },
  { field: "up_sequence_broke_recently", labelKey: "rules.up_sequence_broke_recently", category: "sequence", descriptionKey: "tooltips.up_sequence_broke_recently", operators: ["is_true"], input: "none" },
  { field: "down_sequence_broke_in_strong_up_context", labelKey: "rules.down_sequence_broke_in_strong_up_context", category: "sequence", operators: ["is_true"], input: "none" },
  { field: "up_sequence_broke_in_strong_down_context", labelKey: "rules.up_sequence_broke_in_strong_down_context", category: "sequence", operators: ["is_true"], input: "none" },
  { field: "pct_to_bb_upper", labelKey: "rules.pct_to_bb_upper", category: "location", operators: ["lte", "gte"], input: "number" },
  { field: "pct_to_bb_lower", labelKey: "rules.pct_to_bb_lower", category: "location", operators: ["lte", "gte"], input: "number" },
  { field: "atr_percent", labelKey: "rules.atr_percent", category: "volatility", operators: ["lt", "gt"], input: "number" },
  { field: "atr_14", labelKey: "rules.atr_14", category: "volatility", operators: ["lt", "gt"], input: "number" },
  { field: "close", labelKey: "rules.close", category: "location", operators: ["gte", "lte"], input: "number" },
  { field: "up_sequence_count", labelKey: "rules.up_sequence_count", category: "sequence", operators: ["gte"], input: "number" },
  { field: "down_sequence_count", labelKey: "rules.down_sequence_count", category: "sequence", operators: ["gte"], input: "number" },
  { field: "up_sequence_break_bars_ago", labelKey: "rules.up_sequence_break_bars_ago", category: "sequence", operators: ["lte"], input: "number" },
  { field: "down_sequence_break_bars_ago", labelKey: "rules.down_sequence_break_bars_ago", category: "sequence", operators: ["lte"], input: "number" },
  {
    field: "fib_zone",
    labelKey: "rules.fib_zone",
    category: "location",
    operators: ["eq"],
    input: "select",
    valueOptions: [
      { value: "0_382", labelKey: "fibZones.0_382" },
      { value: "382_500", labelKey: "fibZones.382_500" },
      { value: "500_618", labelKey: "fibZones.500_618" },
      { value: "618_786", labelKey: "fibZones.618_786" },
      { value: "786_100", labelKey: "fibZones.786_100" },
    ],
  },
];

const LEGACY_BOOLEAN_FIELDS: Record<string, ScreenerRuleField> = {
  is_above_sma20: "is_above_sma20",
  is_below_sma20: "is_below_sma20",
  is_above_sma50: "is_above_sma50",
  is_below_sma50: "is_below_sma50",
  is_above_sma150: "is_above_sma150",
  is_below_sma150: "is_below_sma150",
  is_above_sma200: "is_above_sma200",
  is_below_sma200: "is_below_sma200",
  down_sequence_broke_recently: "down_sequence_broke_recently",
  up_sequence_broke_recently: "up_sequence_broke_recently",
  down_sequence_broke_in_strong_up_context: "down_sequence_broke_in_strong_up_context",
  up_sequence_broke_in_strong_down_context: "up_sequence_broke_in_strong_down_context",
  buy_signal: "buy_signal",
  sell_signal: "sell_signal",
  strong_buy_signal: "strong_buy_signal",
  strong_sell_signal: "strong_sell_signal",
  bullish_sequence_active: "bullish_sequence_active",
  bearish_sequence_active: "bearish_sequence_active",
  strong_up_sequence_context: "strong_up_sequence_context",
  strong_down_sequence_context: "strong_down_sequence_context",
};

const LEGACY_NUMERIC_FIELDS: Record<
  string,
  { field: ScreenerRuleField; operator: ScreenerRule["operator"] }
> = {
  pct_to_bb_upper_lte: { field: "pct_to_bb_upper", operator: "lte" },
  pct_to_bb_lower_lte: { field: "pct_to_bb_lower", operator: "lte" },
  pct_to_bb_upper_gte: { field: "pct_to_bb_upper", operator: "gte" },
  pct_to_bb_lower_gte: { field: "pct_to_bb_lower", operator: "gte" },
  atr_percent_lt: { field: "atr_percent", operator: "lt" },
  atr_percent_gt: { field: "atr_percent", operator: "gt" },
  atr_14_lt: { field: "atr_14", operator: "lt" },
  atr_14_gt: { field: "atr_14", operator: "gt" },
  close_gte: { field: "close", operator: "gte" },
  close_lte: { field: "close", operator: "lte" },
  up_sequence_count_gte: { field: "up_sequence_count", operator: "gte" },
  down_sequence_count_gte: { field: "down_sequence_count", operator: "gte" },
  up_sequence_break_bars_ago_lte: { field: "up_sequence_break_bars_ago", operator: "lte" },
  down_sequence_break_bars_ago_lte: { field: "down_sequence_break_bars_ago", operator: "lte" },
};

function cleanNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return value;
}

export function createRule(
  field: ScreenerRuleField = "buy_signal",
  timeframe: ScreenerTimeframe = "1D"
): ScreenerRule {
  const definition = RULE_DEFINITIONS.find((rule) => rule.field === field) ?? RULE_DEFINITIONS[0];
  const value =
    definition.input === "number"
      ? 0
      : definition.input === "select"
        ? definition.valueOptions?.[0]?.value
        : undefined;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timeframe,
    field,
    operator: definition.operators[0] as ScreenerRule["operator"],
    value,
  };
}

export function normalizePayload(input: Partial<ScreenerPayload> | null | undefined): ScreenerPayload {
  const rules = Array.isArray(input?.rules)
    ? input.rules
        .filter((rule): rule is ScreenerRule => !!rule && typeof rule.field === "string")
        .map((rule) => {
          const definition = RULE_DEFINITIONS.find((item) => item.field === rule.field);
          const timeframe: ScreenerTimeframe =
            rule.timeframe === "1W" || rule.timeframe === "1M" ? rule.timeframe : "1D";
          return {
            id: rule.id || createRule(rule.field, rule.timeframe).id,
            timeframe,
            field: rule.field,
            operator: definition?.operators.includes(rule.operator) ? rule.operator : (definition?.operators[0] as ScreenerRule["operator"]),
            value: rule.value,
          };
        })
    : [];
  return {
    version: 1,
    listing_market:
      input?.listing_market === "US" || input?.listing_market === "TA"
        ? input.listing_market
        : undefined,
    market_cap_gte: cleanNumber(input?.market_cap_gte),
    market_cap_lte: cleanNumber(input?.market_cap_lte),
    rules,
  };
}

export function migrateLegacyFilters(legacy: LegacyScreenerFilters): ScreenerPayload {
  const rules: ScreenerRule[] = [];
  for (const [key, field] of Object.entries(LEGACY_BOOLEAN_FIELDS)) {
    if (legacy[key as keyof LegacyScreenerFilters] === true) {
      rules.push({
        id: `${key}-1d`,
        timeframe: "1D",
        field,
        operator: "is_true",
      });
    }
  }
  for (const [key, config] of Object.entries(LEGACY_NUMERIC_FIELDS)) {
    const value = legacy[key as keyof LegacyScreenerFilters];
    if (typeof value === "number" && !Number.isNaN(value)) {
      rules.push({
        id: `${key}-1d`,
        timeframe: "1D",
        field: config.field,
        operator: config.operator,
        value,
      });
    }
  }
  return normalizePayload({
    version: 1,
    listing_market: legacy.listing_market,
    rules,
  });
}

export function coerceStoredScreen(value: unknown): ScreenerPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version === 1 && Array.isArray(candidate.rules)) {
    return normalizePayload(candidate as Partial<ScreenerPayload>);
  }
  return migrateLegacyFilters(candidate as LegacyScreenerFilters);
}

export function parseScreenFromSearchParams(params: URLSearchParams): ScreenerPayload {
  const screen = params.get("screen");
  if (screen) {
    try {
      return normalizePayload(JSON.parse(screen) as Partial<ScreenerPayload>);
    } catch {
      return DEFAULT_SCREENER_PAYLOAD;
    }
  }
  const legacy: LegacyScreenerFilters = {};
  const listing = params.get("listing_market");
  if (listing === "US" || listing === "TA") legacy.listing_market = listing;
  for (const key of Object.keys(LEGACY_BOOLEAN_FIELDS)) {
    if (params.get(key) === "true") {
      (legacy as Record<string, boolean>)[key] = true;
    }
  }
  for (const key of Object.keys(LEGACY_NUMERIC_FIELDS)) {
    const raw = params.get(key);
    if (raw == null || raw === "") continue;
    const value = Number.parseFloat(raw);
    if (!Number.isNaN(value)) {
      (legacy as Record<string, number>)[key] = value;
    }
  }
  return migrateLegacyFilters(legacy);
}

export function screenToQueryString(payload: ScreenerPayload): string {
  const normalized = normalizePayload(payload);
  if (countActiveFilters(normalized) === 0) return "";
  const params = new URLSearchParams();
  params.set("screen", JSON.stringify(normalized));
  return `?${params.toString()}`;
}

export function countActiveFilters(payload: ScreenerPayload): number {
  let count = payload.rules.length;
  if (payload.listing_market) count += 1;
  if (payload.market_cap_gte !== undefined) count += 1;
  if (payload.market_cap_lte !== undefined) count += 1;
  return count;
}

export function payloadToApiBody(payload: ScreenerPayload): ScreenerPayload {
  return normalizePayload(payload);
}

export function matchedTimeframes(payload: ScreenerPayload): ScreenerTimeframe[] {
  const set = new Set<ScreenerTimeframe>(["1D"]);
  for (const rule of payload.rules) set.add(rule.timeframe);
  return [...set];
}

export function ruleDefinitionsByField(): Record<ScreenerRuleField, RuleDefinition> {
  return Object.fromEntries(
    RULE_DEFINITIONS.map((definition) => [definition.field, definition])
  ) as Record<ScreenerRuleField, RuleDefinition>;
}

export function activeRuleCountForTimeframe(
  payload: ScreenerPayload,
  timeframe: ScreenerTimeframe
): number {
  return payload.rules.filter((rule) => rule.timeframe === timeframe).length;
}

export function ruleLabelKey(field: ScreenerRuleField): string {
  return ruleDefinitionsByField()[field]?.labelKey ?? field;
}

export function filtersToTvStudies(payload: ScreenerPayload): TvStudySpec[] {
  const studies: TvStudySpec[] = [];
  const dailyRules = payload.rules.filter((rule) => rule.timeframe === "1D");
  const smaPeriods = new Set<number>();
  for (const rule of dailyRules) {
    const match = rule.field.match(/^is_(?:above|below)_sma(\d+)$/);
    if (match) smaPeriods.add(Number(match[1]));
  }
  for (const length of smaPeriods) {
    studies.push({ id: "MASimple@tv-basicstudies", inputs: { length } });
  }
  if (dailyRules.some((rule) => rule.field === "pct_to_bb_upper" || rule.field === "pct_to_bb_lower")) {
    studies.push({ id: "BB@tv-basicstudies", inputs: { length: 20, mult: 2, matype: 0 } });
  }
  if (dailyRules.some((rule) => rule.field === "atr_percent" || rule.field === "atr_14")) {
    studies.push({ id: "ATR@tv-basicstudies", inputs: { length: 14 } });
  }
  return studies;
}

export function hasSequenceFilters(payload: ScreenerPayload): boolean {
  return payload.rules.some((rule) =>
    [
      "down_sequence_broke_recently",
      "up_sequence_broke_recently",
      "down_sequence_broke_in_strong_up_context",
      "up_sequence_broke_in_strong_down_context",
      "buy_signal",
      "sell_signal",
      "strong_buy_signal",
      "strong_sell_signal",
      "bullish_sequence_active",
      "bearish_sequence_active",
      "strong_up_sequence_context",
      "strong_down_sequence_context",
      "up_sequence_count",
      "down_sequence_count",
      "up_sequence_break_bars_ago",
      "down_sequence_break_bars_ago",
      "fib_zone",
    ].includes(rule.field)
  );
}

export function smaPeriodsFromFilters(payload: ScreenerPayload): number[] {
  const periods = new Set<number>();
  for (const rule of payload.rules) {
    if (rule.timeframe !== "1D") continue;
    const match = rule.field.match(/^is_(?:above|below)_sma(\d+)$/);
    if (match) periods.add(Number(match[1]));
  }
  return periods.size > 0 ? [...periods] : [20, 50];
}

export function formatTickerForTradingView(ticker: string): string {
  return ticker.toUpperCase().replace(/\./g, "-");
}

export function tradingViewSymbol(
  ticker: string,
  listingExchange?: string | null
): string {
  const raw = ticker.trim();
  if (/\.TA$/i.test(raw)) {
    const base = raw.replace(/\.TA$/i, "").replace(/\./g, "-").toUpperCase();
    return `TASE:${base}`;
  }
  const t = formatTickerForTradingView(raw);
  const ex =
    (listingExchange && listingExchange.trim()) ||
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_TRADINGVIEW_EXCHANGE) ||
    "NASDAQ";
  return `${ex}:${t}`;
}
