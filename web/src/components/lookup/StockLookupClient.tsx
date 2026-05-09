"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMessages, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PremiumGate } from "@/components/billing/PremiumGate";
import { screenToQueryString } from "@/lib/screener-query";
import type { LegacyScreenerFilters, ScreenerPayload, ScreenerResultRow, ScreenerRule, ScreenerTimeframe, SnapshotRow } from "@/lib/screener-types";
import { InsightPanel } from "./InsightPanel";
import { LookupActionsBar } from "./LookupActionsBar";
import { MatchedConditionsPanel } from "./MatchedConditionsPanel";
import { SimilarStocksTable } from "./SimilarStocksTable";
import { StockLookupHeader } from "./StockLookupHeader";
import { TechnicalSummaryPanel } from "./TechnicalSummaryPanel";
import type {
  AccessGate,
  CoverageEntry,
  LookupCondition,
  LookupCoveragePayload,
  SimilarSetupRow,
  SimilarVariant,
  SimilarVariantOption,
  Suggestion,
  TrendTone,
} from "./types";

function debounceFn(fn: (arg: string) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (arg: string) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(arg), ms);
  };
}

function formatReason(
  template: string | undefined,
  params?: Record<string, string | number>
): string {
  if (!template) return "";
  let s = template;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

function compactNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000_000 ? 1 : 0,
  }).format(value);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 3,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function makeSparklinePoints(bars: LookupCoveragePayload["recentBars"]): string {
  if (bars.length === 0) return "0,18 100,18";
  const ordered = [...bars].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  const closes = ordered.map((bar) => Number(bar.close));
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = Math.max(max - min, 1e-6);
  return closes
    .map((close, index) => {
      const x = (index / Math.max(closes.length - 1, 1)) * 100;
      const y = 32 - ((close - min) / range) * 28;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function computeDailyMovePct(bars: LookupCoveragePayload["recentBars"]): number | null {
  if (bars.length < 2) return null;
  const ordered = [...bars].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  const prev = Number(ordered[ordered.length - 2]?.close);
  const latest = Number(ordered[ordered.length - 1]?.close);
  if (!Number.isFinite(prev) || !Number.isFinite(latest) || prev === 0) return null;
  return ((latest - prev) / prev) * 100;
}

function trendTone(snapshot: SnapshotRow | null | undefined): TrendTone {
  if (!snapshot) return "neutral";
  if (
    snapshot.strong_buy_signal ||
    snapshot.buy_signal ||
    snapshot.bullish_sequence_active ||
    snapshot.strong_up_sequence_context
  ) {
    return "bullish";
  }
  if (
    snapshot.strong_sell_signal ||
    snapshot.sell_signal ||
    snapshot.bearish_sequence_active ||
    snapshot.strong_down_sequence_context
  ) {
    return "bearish";
  }
  return "neutral";
}

function conditionKey(rule?: ScreenerRule) {
  if (!rule) return "";
  return `${rule.timeframe}:${rule.field}:${rule.operator}:${String(rule.value ?? "")}`;
}

function dedupeRules(rules: ScreenerRule[]): ScreenerRule[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const key = conditionKey(rule);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildRule(
  timeframe: ScreenerTimeframe,
  field: ScreenerRule["field"],
  operator: ScreenerRule["operator"] = "is_true",
  value?: number | string | boolean
): ScreenerRule {
  return {
    id: `${timeframe}-${field}-${operator}-${String(value ?? "true")}`,
    timeframe,
    field,
    operator,
    value,
  };
}

function conditionLabel(
  timeframe: ScreenerTimeframe,
  timeframeLabel: string,
  label: string,
  status: LookupCondition["status"],
  rule?: ScreenerRule,
  note?: string | null
): LookupCondition {
  return {
    id: `${timeframe}-${label.toLowerCase().replace(/\s+/g, "-")}-${status}`,
    timeframe,
    timeframeLabel,
    label,
    status,
    rule,
    note,
  };
}

function scoreRow(baseRules: ScreenerRule[], reference: LookupCoveragePayload, row: ScreenerResultRow): SimilarSetupRow {
  let score = 58;
  for (const rule of baseRules) {
    const snapshot = row.timeframe_snapshots?.[rule.timeframe] ?? (rule.timeframe === "1D" ? row : null);
    if (!snapshot) continue;
    const fieldValue = snapshot[rule.field as keyof SnapshotRow];
    if (rule.operator === "is_true" && fieldValue === true) score += 8;
    if (rule.operator === "gt" && typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue > rule.value) score += 6;
    if (rule.operator === "lt" && typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue < rule.value) score += 6;
    if (rule.operator === "lte" && typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue <= rule.value) score += 6;
    if (rule.operator === "gte" && typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue >= rule.value) score += 6;
  }

  const rowDaily = row.timeframe_snapshots?.["1D"] ?? row;
  const refDaily = reference.dailySnapshot;
  if (trendTone(rowDaily) === trendTone(refDaily)) score += 10;
  if ((rowDaily.atr_percent ?? 0) > (refDaily.atr_percent ?? 0)) score += 4;
  if (row.timeframe_snapshots?.["1W"]?.bullish_sequence_active === reference.timeframeSnapshots["1W"]?.bullish_sequence_active) score += 4;
  if (row.timeframe_snapshots?.["1M"]?.bullish_sequence_active === reference.timeframeSnapshots["1M"]?.bullish_sequence_active) score += 4;

  const atrDiff = Math.abs((rowDaily.atr_percent ?? 0) - (refDaily.atr_percent ?? 0));
  const notes: string[] = [];
  if (rowDaily.strong_buy_signal) notes.push("Stronger momentum");
  else if (rowDaily.buy_signal) notes.push("Active daily break");
  if (atrDiff <= 1) notes.push("ATR profile is close");
  else if ((rowDaily.atr_percent ?? 0) < (refDaily.atr_percent ?? 0)) notes.push("Lower volatility");
  else notes.push("Higher volatility");
  if (row.timeframe_snapshots?.["1W"]?.bullish_sequence_active && row.timeframe_snapshots?.["1M"]?.bullish_sequence_active) {
    notes.push("Higher-timeframe alignment");
  }

  return {
    row,
    score: Math.min(99, Math.max(62, Math.round(score))),
    note: notes.slice(0, 2).join(" · "),
  };
}

function buildQuickExactPayload(coverage: LookupCoveragePayload): ScreenerPayload {
  const rules: ScreenerRule[] = [];
  const daily = coverage.dailySnapshot;
  const weekly = coverage.timeframeSnapshots["1W"];
  const monthly = coverage.timeframeSnapshots["1M"];

  if (daily.strong_buy_signal) rules.push(buildRule("1D", "strong_buy_signal"));
  else if (daily.buy_signal) rules.push(buildRule("1D", "buy_signal"));
  if (daily.bullish_sequence_active) rules.push(buildRule("1D", "bullish_sequence_active"));
  if (daily.strong_up_sequence_context) rules.push(buildRule("1D", "strong_up_sequence_context"));
  if (daily.is_above_sma20) rules.push(buildRule("1D", "is_above_sma20"));
  if (daily.is_above_sma150) rules.push(buildRule("1D", "is_above_sma150"));
  if ((daily.atr_percent ?? 0) >= 5) rules.push(buildRule("1D", "atr_percent", "gt", 5));
  if (weekly?.bullish_sequence_active) rules.push(buildRule("1W", "bullish_sequence_active"));
  if (monthly?.bullish_sequence_active) rules.push(buildRule("1M", "bullish_sequence_active"));

  return {
    version: 1,
    listing_market: coverage.market === "TA" ? "TA" : "US",
    rules: dedupeRules(rules).slice(0, 6),
  };
}

export function StockLookupClient() {
  const t = useTranslations("lookup");
  const tScr = useTranslations("screener");
  const messages = useMessages() as {
    lookup: {
      indicators: Record<string, string>;
      filterLabels: Record<string, string>;
      reason: Record<string, string>;
    };
  };
  const lookupMsg = messages.lookup;
  const listId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestedTickerRef = useRef<string | null>(null);

  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [coverage, setCoverage] = useState<LookupCoveragePayload | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [similarRows, setSimilarRows] = useState<SimilarSetupRow[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [activeVariant, setActiveVariant] = useState<SimilarVariant>("exact");
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [accessGate, setAccessGate] = useState<AccessGate>(null);

  const timeframeLabel = useCallback((timeframe: ScreenerTimeframe) => {
    if (timeframe === "1D") return t("timeframes.1D");
    if (timeframe === "1W") return t("timeframes.1W");
    return t("timeframes.1M");
  }, [t]);

  const syncTickerUrl = useCallback((ticker: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ticker", ticker);
    const next = `${pathname}?${params.toString()}`;
    router.replace(next, { scroll: false });
  }, [pathname, router, searchParams]);

  const runSearch = useCallback(async (prefix: string) => {
    const trimmed = prefix.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggest(true);
    setError("");
    setAccessGate(null);
    try {
      const res = await fetch(`/api/tickers/search?q=${encodeURIComponent(trimmed)}`);
      if (res.status === 401) {
        setAccessGate("login");
        setSuggestions([]);
        return;
      }
      if (res.status === 403) {
        setAccessGate("subscribe");
        setSuggestions([]);
        return;
      }
      if (res.status === 400) {
        setSuggestions([]);
        setError(t("invalidPrefix"));
        return;
      }
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
      setError(t("searchFailed"));
    } finally {
      setLoadingSuggest(false);
    }
  }, [t]);

  const debouncedSearch = useMemo(
    () =>
      debounceFn((prefix: string) => {
        void runSearch(prefix);
      }, 280),
    [runSearch]
  );

  useEffect(() => {
    debouncedSearch(q);
  }, [q, debouncedSearch]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const filterLabel = useCallback((key: string): string => {
    const m = key.match(/^is_(above|below)_sma(\d+)$/);
    if (m) {
      const period = Number(m[2]);
      return m[1] === "above"
        ? tScr("ma.aboveSMA", { period })
        : tScr("ma.belowSMA", { period });
    }
    const mapKeys: (keyof LegacyScreenerFilters)[] = [
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
    if (mapKeys.includes(key as keyof LegacyScreenerFilters)) {
      return lookupMsg.filterLabels[key] ?? key.replace(/_/g, " ");
    }
    return key;
  }, [lookupMsg.filterLabels, tScr]);

  const reasonText = useCallback((entry: CoverageEntry): string | null => {
    if (!entry.reasonKey) return null;
    const template = lookupMsg.reason[entry.reasonKey];
    return formatReason(template, entry.reasonParams) || null;
  }, [lookupMsg.reason]);

  const loadSimilar = useCallback(async (
    variant: SimilarVariant,
    payload: ScreenerPayload,
    currentCoverage: LookupCoveragePayload
  ) => {
    setActiveVariant(variant);
    setLoadingSimilar(true);
    setAccessGate(null);
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        setAccessGate("login");
        setSimilarRows([]);
        return;
      }
      if (res.status === 403) {
        setAccessGate("subscribe");
        setSimilarRows([]);
        return;
      }
      if (!res.ok) throw new Error("screener");
      const data = (await res.json()) as { rows?: ScreenerResultRow[] };
      const rows = (data.rows ?? [])
        .filter((row) => row.ticker !== currentCoverage.ticker)
        .map((row) => scoreRow(payload.rules, currentCoverage, row))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
      setSimilarRows(rows);
    } catch {
      setSimilarRows([]);
      setError(t("similarFailed"));
    } finally {
      setLoadingSimilar(false);
    }
  }, [t]);

  const loadCoverage = useCallback(async (ticker: string) => {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) return;
    requestedTickerRef.current = normalizedTicker;
    setQ(normalizedTicker);
    setLoadingCoverage(true);
    setLoadingSimilar(true);
    setError("");
    setAccessGate(null);
    setSuggestOpen(false);
    try {
      const res = await fetch(`/api/tickers/${encodeURIComponent(normalizedTicker)}/coverage`);
      if (res.status === 401) {
        setAccessGate("login");
        setCoverage(null);
        return;
      }
      if (res.status === 403) {
        setAccessGate("subscribe");
        setCoverage(null);
        return;
      }
      if (!res.ok) {
        if (res.status === 404) {
          setCoverage(null);
          setError(t("notFound"));
          return;
        }
        throw new Error("coverage");
      }
      const data = (await res.json()) as LookupCoveragePayload;
      setCoverage(data);
      syncTickerUrl(data.ticker);
      setSimilarRows([]);
      void loadSimilar("exact", buildQuickExactPayload(data), data);
    } catch {
      setCoverage(null);
      setError(t("coverageFailed"));
    } finally {
      setLoadingCoverage(false);
      setLoadingSimilar(false);
    }
  }, [loadSimilar, syncTickerUrl, t]);

  useEffect(() => {
    const tickerFromUrl = searchParams.get("ticker")?.trim().toUpperCase();
    if (!tickerFromUrl) return;
    if (coverage?.ticker === tickerFromUrl || requestedTickerRef.current === tickerFromUrl) {
      return;
    }
    void loadCoverage(tickerFromUrl);
  }, [coverage?.ticker, loadCoverage, searchParams]);

  const dailyChangePct = useMemo(() => (coverage ? computeDailyMovePct(coverage.recentBars) : null), [coverage]);
  const sparklinePoints = useMemo(() => (coverage ? makeSparklinePoints(coverage.recentBars) : ""), [coverage]);
  const overallTone = useMemo(() => trendTone(coverage?.dailySnapshot), [coverage]);

  const conditions = useMemo(() => {
    if (!coverage) return { matched: [] as LookupCondition[], near: [] as LookupCondition[], failed: [] as LookupCondition[] };
    const matched: LookupCondition[] = [];
    const near: LookupCondition[] = [];
    const failed: LookupCondition[] = [];

    for (const timeframe of ["1D", "1W", "1M"] as ScreenerTimeframe[]) {
      const snapshot = coverage.timeframeSnapshots[timeframe];
      if (!snapshot) continue;
      const tfLabel = timeframeLabel(timeframe);

      const appendTrendCondition = (
        label: string,
        active: boolean | null | undefined,
        nearActive: boolean,
        ruleField: ScreenerRule["field"],
        note?: string | null
      ) => {
        const rule = buildRule(timeframe, ruleField);
        if (active) matched.push(conditionLabel(timeframe, tfLabel, label, "match", rule, note));
        else if (nearActive) near.push(conditionLabel(timeframe, tfLabel, label, "near", rule, note));
        else failed.push(conditionLabel(timeframe, tfLabel, label, "fail", rule, note));
      };

      appendTrendCondition(
        t("badges.aboveSma20"),
        snapshot.is_above_sma20,
        snapshot.sma_20 != null && snapshot.close >= snapshot.sma_20 * 0.985,
        "is_above_sma20",
        snapshot.sma_20 != null ? `${formatCurrency(snapshot.sma_20)} SMA20` : reasonText(coverage.indicators.find((entry) => entry.id === "sma_20") ?? { id: "", supported: false })
      );
      appendTrendCondition(
        t("badges.aboveSma150"),
        snapshot.is_above_sma150,
        snapshot.sma_150 != null && snapshot.close >= snapshot.sma_150 * 0.985,
        "is_above_sma150"
      );
      appendTrendCondition(
        t("badges.aboveSma200"),
        snapshot.is_above_sma200,
        snapshot.sma_200 != null && snapshot.close >= snapshot.sma_200 * 0.985,
        "is_above_sma200"
      );

      const bullishRule = buildRule(timeframe, "bullish_sequence_active");
      if (snapshot.bullish_sequence_active) matched.push(conditionLabel(timeframe, tfLabel, t("badges.upSequence"), "match", bullishRule));
      else if (snapshot.up_sequence_count >= 2) near.push(conditionLabel(timeframe, tfLabel, t("badges.upSequence"), "near", bullishRule, t("workspace.sequenceBuilding")));
      else failed.push(conditionLabel(timeframe, tfLabel, t("badges.upSequence"), "fail", bullishRule));

      const strongContextRule = buildRule(timeframe, "strong_up_sequence_context");
      if (snapshot.strong_up_sequence_context) matched.push(conditionLabel(timeframe, tfLabel, t("badges.strongUpContext"), "match", strongContextRule));
      else failed.push(conditionLabel(timeframe, tfLabel, t("badges.strongUpContext"), "fail", strongContextRule));

      const buyRule = buildRule(timeframe, "buy_signal");
      if (snapshot.strong_buy_signal) matched.push(conditionLabel(timeframe, tfLabel, t("badges.strongBullish"), "match", buildRule(timeframe, "strong_buy_signal")));
      else if (snapshot.buy_signal) matched.push(conditionLabel(timeframe, tfLabel, t("badges.bullishBreak"), "match", buyRule));
      else if (snapshot.up_sequence_broke_recently) near.push(conditionLabel(timeframe, tfLabel, t("badges.bullishBreak"), "near", buyRule, t("workspace.breakRecently")));
      else failed.push(conditionLabel(timeframe, tfLabel, t("badges.bullishBreak"), "fail", buyRule));
    }

    const daily = coverage.dailySnapshot;
    const atrRule = buildRule("1D", "atr_percent", "gt", 5);
    if ((daily.atr_percent ?? 0) >= 5) matched.push(conditionLabel("1D", timeframeLabel("1D"), t("badges.highAtr"), "match", atrRule, `${formatPercent(daily.atr_percent)}`));
    else if ((daily.atr_percent ?? 0) >= 4) near.push(conditionLabel("1D", timeframeLabel("1D"), t("badges.highAtr"), "near", atrRule));
    else failed.push(conditionLabel("1D", timeframeLabel("1D"), t("badges.highAtr"), "fail", atrRule));

    const upperBbRule = buildRule("1D", "pct_to_bb_upper", "lte", 5);
    if ((daily.pct_to_bb_upper ?? Number.POSITIVE_INFINITY) <= 5) matched.push(conditionLabel("1D", timeframeLabel("1D"), t("badges.nearBreakout"), "match", upperBbRule));
    else if ((daily.pct_to_bb_upper ?? Number.POSITIVE_INFINITY) <= 10) near.push(conditionLabel("1D", timeframeLabel("1D"), t("badges.nearBreakout"), "near", upperBbRule));
    else failed.push(conditionLabel("1D", timeframeLabel("1D"), t("badges.nearBreakout"), "fail", upperBbRule));

    const lowerBbRule = buildRule("1D", "pct_to_bb_lower", "lte", 5);
    if ((daily.pct_to_bb_lower ?? Number.POSITIVE_INFINITY) <= 5) matched.push(conditionLabel("1D", timeframeLabel("1D"), t("badges.nearLowerBand"), "match", lowerBbRule));
    else if ((daily.pct_to_bb_lower ?? Number.POSITIVE_INFINITY) <= 10) near.push(conditionLabel("1D", timeframeLabel("1D"), t("badges.nearLowerBand"), "near", lowerBbRule));
    else failed.push(conditionLabel("1D", timeframeLabel("1D"), t("badges.nearLowerBand"), "fail", lowerBbRule));

    return {
      matched,
      near,
      failed,
    };
  }, [coverage, reasonText, t, timeframeLabel]);

  const headerBadges = useMemo(() => {
    if (!coverage) return [];
    const items = conditions.matched.slice(0, 6).map((condition) => ({
      id: condition.id,
      label: condition.label,
      tone: condition.label === t("badges.strongBullish") || condition.label === t("badges.bullishBreak")
        ? "bullish"
        : condition.label === t("badges.highAtr")
          ? "accent"
          : "neutral",
    })) as { id: string; label: string; tone: TrendTone | "accent" }[];
    return items;
  }, [conditions.matched, coverage, t]);

  const timeframeStates = useMemo(() => {
    if (!coverage) return [];
    return (["1D", "1W", "1M"] as const).map((timeframe) => {
      const snapshot = coverage.timeframeSnapshots[timeframe];
      const tone = trendTone(snapshot);
      const label = t(`status.${tone}`);
      return { timeframe, tone, label };
    });
  }, [coverage, t]);

  const insights = useMemo(() => {
    if (!coverage) return [];
    const daily = coverage.dailySnapshot;
    const weekly = coverage.timeframeSnapshots["1W"];
    const monthly = coverage.timeframeSnapshots["1M"];
    const list: string[] = [];
    if (daily.bullish_sequence_active && weekly?.bullish_sequence_active && monthly?.bullish_sequence_active) {
      list.push(t("insights.fullAlignment"));
    }
    if (daily.sma_20 != null && daily.close > daily.sma_20 * 1.08) {
      list.push(t("insights.extendedFromSma20"));
    }
    if ((daily.pct_to_bb_upper ?? Number.POSITIVE_INFINITY) <= 5) {
      list.push(t("insights.nearResistance"));
    }
    if (daily.strong_buy_signal || daily.buy_signal) {
      list.push(t("insights.momentumAccelerating"));
    }
    if ((daily.atr_percent ?? 0) < 3) {
      list.push(t("insights.lowVolatility"));
    }
    if (list.length === 0) {
      list.push(t("insights.waitingForConfirmation"));
    }
    return list.slice(0, 4);
  }, [coverage, t]);

  const variantOptions = useMemo(() => {
    if (!coverage) return [] as SimilarVariantOption[];
    const matchedRules = dedupeRules(
      conditions.matched
        .map((condition) => condition.rule)
        .filter((rule): rule is ScreenerRule => !!rule)
    );
    const baseRules = matchedRules
      .sort((a, b) => {
        const priority = (rule: ScreenerRule) => {
          if (rule.field === "strong_buy_signal") return 1;
          if (rule.field === "buy_signal") return 2;
          if (rule.field === "bullish_sequence_active") return 3;
          if (rule.field === "strong_up_sequence_context") return 4;
          if (rule.field === "is_above_sma150") return 5;
          if (rule.field === "is_above_sma20") return 6;
          if (rule.field === "atr_percent") return 7;
          return 20;
        };
        return priority(a) - priority(b);
      })
      .slice(0, 6);

    const listing_market: ScreenerPayload["listing_market"] = coverage.market === "TA" ? "TA" : "US";
    const dailyAtr = coverage.dailySnapshot.atr_percent ?? 0;

    return [
      {
        id: "exact" as const,
        label: t("variants.exact"),
        payload: { version: 1, listing_market, rules: baseRules },
      },
      {
        id: "stronger" as const,
        label: t("variants.stronger"),
        payload: {
          version: 1,
          listing_market,
          rules: dedupeRules([...baseRules, buildRule("1D", "strong_buy_signal")]).slice(0, 7),
        },
      },
      {
        id: "earlier" as const,
        label: t("variants.earlier"),
        payload: {
          version: 1,
          listing_market,
          rules: dedupeRules(
            baseRules.filter((rule) => rule.field !== "strong_buy_signal" && rule.field !== "buy_signal")
          ).slice(0, 5),
        },
      },
      {
        id: "lowerAtr" as const,
        label: t("variants.lowerAtr"),
        payload: {
          version: 1,
          listing_market,
          rules: dedupeRules([...baseRules.filter((rule) => rule.field !== "atr_percent"), buildRule("1D", "atr_percent", "lt", Math.max(3, Math.round(dailyAtr)))])
            .slice(0, 7),
        },
      },
      {
        id: "higherMomentum" as const,
        label: t("variants.higherMomentum"),
        payload: {
          version: 1,
          listing_market,
          rules: dedupeRules([...baseRules, buildRule("1D", "atr_percent", "gt", Math.max(3, Math.round(dailyAtr)))])
            .slice(0, 7),
        },
      },
    ] satisfies SimilarVariantOption[];
  }, [conditions.matched, coverage, t]);

  const activeVariantOption = useMemo(
    () => variantOptions.find((option) => option.id === activeVariant) ?? variantOptions[0] ?? null,
    [activeVariant, variantOptions]
  );

  const variantLabels = useMemo(() => {
    const labels = {
      exact: t("variants.exact"),
      stronger: t("variants.stronger"),
      earlier: t("variants.earlier"),
      lowerAtr: t("variants.lowerAtr"),
      higherMomentum: t("variants.higherMomentum"),
    } as Record<SimilarVariant, string>;
    return labels;
  }, [t]);

  const selectedCondition = useMemo(() => {
    const all = [...conditions.matched, ...conditions.near, ...conditions.failed];
    if (all.length === 0) return null;
    return all.find((condition) => condition.id === selectedConditionId) ?? all[0];
  }, [conditions.failed, conditions.matched, conditions.near, selectedConditionId]);

  const activeScreenHref = activeVariantOption ? `/screener${screenToQueryString(activeVariantOption.payload)}` : "/screener";

  function openConditionScan(condition: LookupCondition) {
    if (!condition.rule) return;
      const payload: ScreenerPayload = {
        version: 1,
        listing_market: coverage?.market === "TA" ? "TA" : "US",
        rules: [condition.rule],
    };
    router.push(`/screener${screenToQueryString(payload)}`);
  }

  function combineConditionScan(condition: LookupCondition) {
    if (!condition.rule || !activeVariantOption) return;
    const payload: ScreenerPayload = {
      version: 1,
      listing_market: activeVariantOption.payload.listing_market,
      market_cap_gte: activeVariantOption.payload.market_cap_gte,
      market_cap_lte: activeVariantOption.payload.market_cap_lte,
      rules: dedupeRules([...activeVariantOption.payload.rules, condition.rule]),
    };
    router.push(`/screener${screenToQueryString(payload)}`);
  }

  async function copyConditionText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(t("feedback.copied"));
    } catch {
      setFeedback(t("feedback.copyFailed"));
    }
  }

  function saveSetup() {
    if (!coverage || !activeVariantOption) return;
    try {
      const raw = window.localStorage.getItem("lookupSavedSetups");
      const items = raw ? (JSON.parse(raw) as unknown[]) : [];
      items.unshift({
        ticker: coverage.ticker,
        savedAt: new Date().toISOString(),
        screen: activeVariantOption.payload,
      });
      window.localStorage.setItem("lookupSavedSetups", JSON.stringify(items.slice(0, 20)));
      setFeedback(t("feedback.saved"));
    } catch {
      setFeedback(t("feedback.saveFailed"));
    }
  }

  function compareTicker() {
    wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  const diagnostics = useMemo(() => {
    if (!coverage) return [];
    return coverage.screenerFilters
      .filter((row) => !row.supported)
      .slice(0, 6)
      .map((row) => `${filterLabel(row.filterKey)} · ${reasonText(row) ?? ""}`);
  }, [coverage, filterLabel, reasonText]);

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-6">
      <div className="space-y-5">
        <section className="sticky top-[4.75rem] z-20 rounded-[24px] bg-surface-raised/95 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-border backdrop-blur dark:ring-[#183241]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.kicker")}</p>
              <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-text">{t("workspace.title")}</h1>
              <p className="mt-1 text-sm text-text-secondary">{t("workspace.subtitle")}</p>
            </div>

            <div ref={wrapRef} className="relative w-full max-w-[760px]">
              <div className="rounded-[22px] bg-surface-alt/75 p-2 ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      ref={inputRef}
                      id={`${listId}-input`}
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={t("placeholder")}
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setSuggestOpen(true);
                      }}
                      onFocus={() => setSuggestOpen(true)}
                      aria-autocomplete="list"
                      aria-controls={suggestOpen ? `${listId}-listbox` : undefined}
                      aria-expanded={suggestOpen}
                      className="h-11 rounded-2xl border-0 bg-surface-raised px-4 text-[15px] shadow-sm ring-1 ring-border"
                    />
                  </div>
                  <Button
                    className="h-11 rounded-2xl px-5"
                    onClick={() => {
                      const upper = q.trim().toUpperCase();
                      if (upper) void loadCoverage(upper);
                    }}
                    loading={loadingCoverage}
                  >
                    {t("actions.lookup")}
                  </Button>
                </div>
              </div>

              {suggestOpen && (q.trim().length > 0 || suggestions.length > 0) && (
                <ul
                  id={`${listId}-listbox`}
                  role="listbox"
                  className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-[20px] bg-surface-raised py-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] ring-1 ring-border"
                >
                  {loadingSuggest && (
                    <li className="px-4 py-3 text-sm text-text-muted">{t("loadingSuggest")}</li>
                  )}
                  {!loadingSuggest && suggestions.length === 0 && q.trim().length > 0 && (
                    <li className="px-4 py-3 text-sm text-text-muted">{t("noSuggestions")}</li>
                  )}
                  {suggestions.map((s) => (
                    <li key={s.ticker} role="option" aria-selected={false}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-alt/55"
                        onClick={() => {
                          setQ(s.ticker);
                          void loadCoverage(s.ticker);
                        }}
                      >
                        <div>
                          <p className="text-sm font-bold text-text">{s.ticker}</p>
                          <p className="mt-1 text-[12px] text-text-muted">{s.market ?? "—"} · {s.last_trade_date}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-text-secondary">
                          {formatCurrency(s.close)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger ring-1 ring-danger/15">
            {error}
          </div>
        ) : null}

        {accessGate ? (
          <PremiumGate kind={accessGate === "login" ? "login" : "subscribe"} />
        ) : null}

        {!accessGate && !coverage && !loadingCoverage ? (
          <section className="rounded-[24px] bg-surface-raised px-5 py-8 ring-1 ring-border shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:ring-[#183241]">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.kicker")}</p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-text">{t("workspace.emptyTitle")}</h2>
              <p className="mt-2 text-sm text-text-secondary">{t("workspace.emptyBody")}</p>
            </div>
          </section>
        ) : null}

        {!accessGate && loadingCoverage ? (
          <section className="rounded-[24px] bg-surface-raised px-5 py-8 text-sm text-text-muted ring-1 ring-border shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:ring-[#183241]">
            {t("loadingCoverage")}
          </section>
        ) : null}

        {coverage && !loadingCoverage ? (
          <>
            <StockLookupHeader
              coverage={coverage}
              sparklinePoints={sparklinePoints}
              dailyChangePct={dailyChangePct}
              overallTone={overallTone}
              headerBadges={headerBadges}
              timeframeStates={timeframeStates}
              coreConditions={conditions.matched}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              formatMarketCap={compactNumber}
              t={t}
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_360px]">
              <TechnicalSummaryPanel
                snapshots={coverage.timeframeSnapshots}
                classifyTrend={trendTone}
                formatPercent={formatPercent}
                t={t}
              />
              <div className="space-y-4">
                <LookupActionsBar
                  screenerHref={activeScreenHref}
                  onFindSimilar={() => {
                    if (activeVariantOption) {
                      void loadSimilar(activeVariantOption.id, activeVariantOption.payload, coverage);
                    }
                  }}
                  onSaveSetup={saveSetup}
                  onCopyConditions={() =>
                    copyConditionText(
                      [
                        `${coverage.ticker} setup summary`,
                        ...conditions.matched.map(
                          (condition) => `${condition.timeframeLabel ?? condition.timeframe} · ${condition.label}`
                        ),
                      ].join("\n")
                    )
                  }
                  onCompare={compareTicker}
                  tickerHref={`/ticker/${coverage.ticker}`}
                  feedback={feedback}
                  t={t}
                />
                <InsightPanel insights={insights} t={t} />
              </div>
            </div>

            <MatchedConditionsPanel
              matched={conditions.matched}
              near={conditions.near}
              failed={conditions.failed}
              selectedCondition={selectedCondition}
              onSelectCondition={(condition) => setSelectedConditionId(condition.id)}
              onOpenConditionScan={openConditionScan}
              onCombineConditionScan={combineConditionScan}
              t={t}
            />

            <SimilarStocksTable
              rows={similarRows}
              activeVariant={activeVariant}
              onChangeVariant={(variant) => {
                const option = variantOptions.find((item) => item.id === variant);
                if (option) void loadSimilar(option.id, option.payload, coverage);
              }}
              loading={loadingSimilar}
              variantLabels={variantLabels}
              t={t}
            />

            <section className="rounded-[22px] bg-surface-raised px-4 py-4 ring-1 ring-border shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:ring-[#183241]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.coverageDiagnostics")}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{t("workspace.coverageDiagnosticsSub")}</p>
                </div>
                <Link href={`/ticker/${coverage.ticker}`} className="text-sm font-semibold text-primary hover:underline">
                  {t("openTickerPage")}
                </Link>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <div className="rounded-2xl bg-surface-alt/70 px-4 py-4 ring-1 ring-border">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.unsupportedIndicators")}</p>
                  <div className="mt-3 space-y-2">
                    {coverage.indicators
                      .filter((row) => !row.supported)
                      .slice(0, 6)
                      .map((row) => (
                        <div key={row.id} className="flex items-start justify-between gap-3 text-sm">
                          <span className="font-medium text-text">{lookupMsg.indicators[row.id] ?? row.id}</span>
                          <span className="text-right text-[12px] text-text-muted">{reasonText(row) ?? "—"}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-surface-alt/70 px-4 py-4 ring-1 ring-border">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.unsupportedFilters")}</p>
                  <div className="mt-3 space-y-2">
                    {diagnostics.length > 0 ? diagnostics.map((entry) => (
                      <div key={entry} className="text-sm text-text-secondary">{entry}</div>
                    )) : <div className="text-sm text-text-secondary">{t("workspace.allCoreFiltersReady")}</div>}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
