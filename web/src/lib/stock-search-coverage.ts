import type { ScreenerFilters, SnapshotRow } from "@/lib/screener-types";
import {
  SCREENER_BOOLEAN_FILTER_KEYS,
  SCREENER_NUMERIC_FILTER_KEYS,
} from "@/lib/screener-query";

/** Allowed ticker-prefix characters only (no LIKE wildcards). */
const TICKER_PREFIX_RE = /^[A-Za-z0-9.\-]{1,32}$/;

export type SanitizePrefixResult =
  | { ok: true; prefix: string }
  | { ok: false; error: "empty" | "invalid" };

/**
 * Validates user input for ticker prefix search. Does not pass raw input into SQL;
 * use `prefix` only with parameterized Supabase filters.
 */
export function sanitizeTickerSearchPrefix(
  raw: string | null | undefined
): SanitizePrefixResult {
  if (raw == null) return { ok: false, error: "empty" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  const prefix = trimmed.toUpperCase().slice(0, 32);
  if (!TICKER_PREFIX_RE.test(prefix)) return { ok: false, error: "invalid" };
  return { ok: true, prefix };
}

function isNonNullNumber(v: unknown): boolean {
  return typeof v === "number" && !Number.isNaN(v);
}

export type CoverageEntry = {
  id: string;
  supported: boolean;
  /** i18n key under lookup.reason */
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
};

function smaCol(period: 20 | 50 | 150 | 200): keyof SnapshotRow {
  if (period === 20) return "sma_20";
  if (period === 50) return "sma_50";
  if (period === 150) return "sma_150";
  return "sma_200";
}

function maFilterSupported(
  row: SnapshotRow,
  period: 20 | 50 | 150 | 200,
  barCount: number
): CoverageEntry {
  const col = smaCol(period);
  const ok = isNonNullNumber(row[col]);
  const lowHistory = !ok && barCount < period;
  return {
    id: String(col),
    supported: ok,
    reasonKey: ok
      ? undefined
      : lowHistory
        ? "notEnoughBars"
        : "smaMissing",
    reasonParams: ok ? undefined : { period, bars: barCount },
  };
}

function filterEntry(
  key: keyof ScreenerFilters,
  supported: boolean,
  reasonKey?: string,
  reasonParams?: Record<string, string | number>
): CoverageEntry & { filterKey: keyof ScreenerFilters } {
  return {
    filterKey: key,
    id: String(key),
    supported,
    reasonKey: supported ? undefined : reasonKey,
    reasonParams: supported ? undefined : reasonParams,
  };
}

/**
 * Which chart indicators and screener filters are meaningful for this snapshot + bar count.
 */
export function buildStockLookupCoverage(
  row: SnapshotRow | null,
  barCount: number
): {
  barCount: number;
  indicators: CoverageEntry[];
  screenerFilters: (CoverageEntry & { filterKey: keyof ScreenerFilters })[];
} {
  const indicators: CoverageEntry[] = [];

  if (!row) {
    const missing = {
      supported: false as const,
      reasonKey: "noSnapshot" as const,
    };
    return {
      barCount,
      indicators: [
        { id: "sma_20", ...missing },
        { id: "sma_50", ...missing },
        { id: "sma_150", ...missing },
        { id: "sma_200", ...missing },
        { id: "ema_20", ...missing },
        { id: "bollinger", ...missing },
        { id: "pct_bb", ...missing },
        { id: "atr", ...missing },
        { id: "signals", ...missing },
      ],
      screenerFilters: allFilterKeys().map((k) =>
        filterEntry(k, false, "noSnapshot")
      ),
    };
  }

  const sma = (p: 20 | 50 | 150 | 200) => {
    const col = smaCol(p);
    const ok = isNonNullNumber(row[col]);
    const lowHistory = !ok && barCount < p;
    indicators.push({
      id: String(col),
      supported: ok,
      reasonKey: ok
        ? undefined
        : lowHistory
          ? "notEnoughBars"
          : "smaMissing",
      reasonParams: ok ? undefined : { period: p, bars: barCount },
    });
  };
  sma(20);
  sma(50);
  sma(150);
  sma(200);

  const emaOk = isNonNullNumber(row.ema_20);
  indicators.push({
    id: "ema_20",
    supported: emaOk,
    reasonKey: emaOk ? undefined : "emaMissing",
    reasonParams: emaOk ? undefined : { bars: barCount },
  });

  const bbOk =
    isNonNullNumber(row.bb_upper_20_2) &&
    isNonNullNumber(row.bb_lower_20_2);
  indicators.push({
    id: "bollinger",
    supported: bbOk,
    reasonKey: bbOk ? undefined : "bbMissing",
  });

  const pctOk =
    isNonNullNumber(row.pct_to_bb_upper) &&
    isNonNullNumber(row.pct_to_bb_lower);
  indicators.push({
    id: "pct_bb",
    supported: pctOk,
    reasonKey: pctOk ? undefined : "pctBbMissing",
  });

  const atrOk =
    isNonNullNumber(row.atr_14) && isNonNullNumber(row.atr_percent);
  indicators.push({
    id: "atr",
    supported: atrOk,
    reasonKey: atrOk ? undefined : "atrMissing",
  });

  indicators.push({
    id: "signals",
    supported: true,
  });

  const screenerFilters = buildFilterCoverage(row, barCount);

  return { barCount, indicators, screenerFilters };
}

function allFilterKeys(): (keyof ScreenerFilters)[] {
  const keys = new Set<keyof ScreenerFilters>([
    ...SCREENER_BOOLEAN_FILTER_KEYS,
    ...SCREENER_NUMERIC_FILTER_KEYS,
  ]);
  return [...keys];
}

function buildFilterCoverage(
  row: SnapshotRow,
  barCount: number
): (CoverageEntry & { filterKey: keyof ScreenerFilters })[] {
  const out: (CoverageEntry & { filterKey: keyof ScreenerFilters })[] = [];

  for (const key of SCREENER_BOOLEAN_FILTER_KEYS) {
    if (key.startsWith("is_above_sma") || key.startsWith("is_below_sma")) {
      const m = key.match(/is_(above|below)_sma(\d+)/);
      const period = m
        ? (Number.parseInt(m[2], 10) as 20 | 50 | 150 | 200)
        : 20;
      const e = maFilterSupported(row, period, barCount);
      out.push({
        filterKey: key,
        id: String(key),
        supported: e.supported,
        reasonKey: e.reasonKey,
        reasonParams: { ...e.reasonParams, side: m?.[1] ?? "above" },
      });
      continue;
    }
    out.push(filterEntry(key, true));
  }

  for (const key of SCREENER_NUMERIC_FILTER_KEYS) {
    if (
      key === "pct_to_bb_upper_lte" ||
      key === "pct_to_bb_upper_gte"
    ) {
      const ok = isNonNullNumber(row.pct_to_bb_upper);
      out.push(
        filterEntry(key, ok, ok ? undefined : "pctBbUpperMissing")
      );
      continue;
    }
    if (
      key === "pct_to_bb_lower_lte" ||
      key === "pct_to_bb_lower_gte"
    ) {
      const ok = isNonNullNumber(row.pct_to_bb_lower);
      out.push(
        filterEntry(key, ok, ok ? undefined : "pctBbLowerMissing")
      );
      continue;
    }
    if (key === "atr_percent_lt" || key === "atr_percent_gt") {
      const ok = isNonNullNumber(row.atr_percent);
      out.push(
        filterEntry(key, ok, ok ? undefined : "atrPercentMissing")
      );
      continue;
    }
    if (key === "atr_14_lt" || key === "atr_14_gt") {
      const ok = isNonNullNumber(row.atr_14);
      out.push(filterEntry(key, ok, ok ? undefined : "atr14Missing"));
      continue;
    }
    if (key === "close_gte" || key === "close_lte") {
      out.push(filterEntry(key, isNonNullNumber(row.close)));
      continue;
    }
    if (key === "up_sequence_count_gte" || key === "down_sequence_count_gte") {
      out.push(filterEntry(key, true));
      continue;
    }
    if (key === "up_sequence_break_bars_ago_lte") {
      const ok = row.up_sequence_break_bars_ago != null;
      out.push(
        filterEntry(key, ok, ok ? undefined : "breakBarsMissing")
      );
      continue;
    }
    if (key === "down_sequence_break_bars_ago_lte") {
      const ok = row.down_sequence_break_bars_ago != null;
      out.push(
        filterEntry(key, ok, ok ? undefined : "breakBarsMissing")
      );
      continue;
    }
    out.push(filterEntry(key, true));
  }

  return out;
}
