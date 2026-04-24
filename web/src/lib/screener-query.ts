import type { ScreenerFilters } from "@/lib/screener-types";

export type TvStudySpec = {
  id: string;
  inputs?: Record<string, number | string>;
};

/** Exported for stock lookup / coverage (screener parity). */
export const SCREENER_NUMERIC_FILTER_KEYS: (keyof ScreenerFilters)[] = [
  "pct_to_bb_upper_lte",
  "pct_to_bb_lower_lte",
  "pct_to_bb_upper_gte",
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

/** Exported for stock lookup / coverage (screener parity). */
export const SCREENER_BOOLEAN_FILTER_KEYS: (keyof ScreenerFilters)[] = [
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

export function filtersToQueryString(filters: ScreenerFilters): string {
  const p = new URLSearchParams();
  if (filters.listing_market === "US" || filters.listing_market === "TA") {
    p.set("listing_market", filters.listing_market);
  }
  for (const key of SCREENER_BOOLEAN_FILTER_KEYS) {
    const v = filters[key];
    if (v === true) p.set(key as string, "true");
  }
  for (const key of SCREENER_NUMERIC_FILTER_KEYS) {
    const v = filters[key];
    if (v !== undefined && v !== null && !Number.isNaN(v)) {
      p.set(key as string, String(v));
    }
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function parseFiltersFromSearchParams(
  params: URLSearchParams
): ScreenerFilters {
  const f: ScreenerFilters = {};
  const lm = params.get("listing_market");
  if (lm === "US" || lm === "TA") {
    f.listing_market = lm;
  }
  for (const key of SCREENER_BOOLEAN_FILTER_KEYS) {
    if (params.get(key as string) === "true") {
      (f as Record<string, boolean>)[key as string] = true;
    }
  }
  for (const key of SCREENER_NUMERIC_FILTER_KEYS) {
    const raw = params.get(key as string);
    if (raw === null || raw === "") continue;
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) {
      (f as Record<string, number>)[key as string] = n;
    }
  }
  return f;
}

export function countActiveFilters(filters: ScreenerFilters): number {
  return Object.values(filters).filter(
    (v) => v !== undefined && v !== null && v !== ""
  ).length;
}

export function filtersToTvStudies(filters: ScreenerFilters): TvStudySpec[] {
  const studies: TvStudySpec[] = [];
  const smaPeriods: number[] = [];
  for (const period of [20, 50, 150, 200] as const) {
    const above = filters[`is_above_sma${period}` as keyof ScreenerFilters];
    const below = filters[`is_below_sma${period}` as keyof ScreenerFilters];
    if (above === true || below === true) smaPeriods.push(period);
  }
  for (const length of smaPeriods) {
    studies.push({
      id: "MASimple@tv-basicstudies",
      inputs: { length },
    });
  }
  if (
    filters.pct_to_bb_upper_lte !== undefined ||
    filters.pct_to_bb_lower_lte !== undefined ||
    filters.pct_to_bb_upper_gte !== undefined ||
    filters.pct_to_bb_lower_gte !== undefined
  ) {
    studies.push({
      id: "BB@tv-basicstudies",
      inputs: { length: 20, mult: 2, matype: 0 },
    });
  }
  if (
    filters.atr_percent_lt !== undefined ||
    filters.atr_percent_gt !== undefined ||
    filters.atr_14_lt !== undefined ||
    filters.atr_14_gt !== undefined
  ) {
    studies.push({
      id: "ATR@tv-basicstudies",
      inputs: { length: 14 },
    });
  }
  return studies;
}

export function hasSequenceFilters(filters: ScreenerFilters): boolean {
  return (
    filters.down_sequence_broke_recently === true ||
    filters.up_sequence_broke_recently === true ||
    filters.down_sequence_broke_in_strong_up_context === true ||
    filters.up_sequence_broke_in_strong_down_context === true ||
    filters.buy_signal === true ||
    filters.sell_signal === true ||
    filters.strong_buy_signal === true ||
    filters.strong_sell_signal === true ||
    filters.bullish_sequence_active === true ||
    filters.bearish_sequence_active === true ||
    filters.strong_up_sequence_context === true ||
    filters.strong_down_sequence_context === true ||
    filters.up_sequence_count_gte !== undefined ||
    filters.down_sequence_count_gte !== undefined ||
    filters.up_sequence_break_bars_ago_lte !== undefined ||
    filters.down_sequence_break_bars_ago_lte !== undefined
  );
}

export function formatTickerForTradingView(ticker: string): string {
  return ticker.toUpperCase().replace(/\./g, "-");
}

/** SMA lengths referenced by active MA screener filters (for app chart overlay). */
export function smaPeriodsFromFilters(filters: ScreenerFilters): number[] {
  const out: number[] = [];
  for (const period of [20, 50, 150, 200] as const) {
    const above = filters[`is_above_sma${period}` as keyof ScreenerFilters];
    const below = filters[`is_below_sma${period}` as keyof ScreenerFilters];
    if (above === true || below === true) out.push(period);
  }
  return out.length > 0 ? out : [20, 50];
}

export function tradingViewSymbol(
  ticker: string,
  listingExchange?: string | null
): string {
  const raw = ticker.trim();
  if (/\.TA$/i.test(raw)) {
    const base = raw
      .replace(/\.TA$/i, "")
      .replace(/\./g, "-")
      .toUpperCase();
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
