"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import type {
  ScreenerPayload,
  ScannerSortDir,
  ScannerSortKey,
  ScreenerResultRow,
  ScreenerRule,
  ScreenerSectorBreakdownItem,
  ScreenerTimeframe,
  ScannerResultSnapshot,
} from "@/lib/screener-types";
import {
  countActiveFilters,
  ruleDefinitionsByField,
  screenToQueryString,
  tradingViewFullChartUrlForTicker,
} from "@/lib/screener-query";

type DensityMode = "comfortable" | "compact";

interface ResultsTableProps {
  rows: ScreenerResultRow[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  sortKey: ScannerSortKey;
  sortDir: ScannerSortDir;
  onSortChange: (key: ScannerSortKey) => void;
  screenerFilters?: ScreenerPayload;
  totalCount?: number | null;
  sectorBreakdown?: ScreenerSectorBreakdownItem[];
  lastUpdatedLabel?: string | null;
  onEditFilters?: () => void;
}

const SECTOR_TRANSLATION_KEYS: Record<string, string> = {
  "Basic Materials": "basicMaterials",
  "Communication Services": "communicationServices",
  "Consumer Cyclical": "consumerCyclical",
  "Consumer Defensive": "consumerDefensive",
  Energy: "energy",
  "Financial Services": "financialServices",
  Healthcare: "healthcare",
  Industrials: "industrials",
  "Real Estate": "realEstate",
  Technology: "technology",
  Utilities: "utilities",
};

const SECTOR_COLORS = [
  "bg-primary",
  "bg-success",
  "bg-warning",
  "bg-[#8b5cf6]",
  "bg-[#06b6d4]",
];

function fmt(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

function MatchScoreBadge({ score }: { score: number | null | undefined }) {
  const t = useTranslations("screener");
  if (score == null) return <span className="text-text-muted">—</span>;
  const tone = score >= 80
    ? "bg-success-soft text-success ring-success/20"
    : score >= 60
      ? "bg-primary-soft text-primary ring-primary/20"
      : "bg-warning-soft text-warning ring-warning/20";
  return (
    <span className={clsx(
      "inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 font-bold tabular-nums ring-1",
      tone
    )}>
      <span className="text-sm">{Math.round(score)}</span>
      <span className="text-[9px] uppercase tracking-wide">{t("discovery.score")}</span>
    </span>
  );
}

function MatchExplanation({ row, guided = false }: { row: ScreenerResultRow; guided?: boolean }) {
  const t = useTranslations("screener");
  const reasons = row.match_reasons ?? [];
  const risk = row.risk_flags?.[0];
  if (reasons.length === 0 && !risk) {
    return <p className="text-[11px] leading-relaxed text-text-muted">{t("discovery.noEvidence")}</p>;
  }
  return (
    <div className="ui-panel-subtle space-y-2 rounded-xl p-3">
      {reasons.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
            {guided ? t("discovery.whyMatched") : t("discovery.notableContext")}
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-text-secondary">
            {reasons.slice(0, 3).map((reason) => (
              <li key={reason} className="flex items-start gap-1.5">
                <span className="mt-0.5 text-success">✓</span>
                <span>{t(`discovery.reasons.${reason}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {risk ? (
        <div className="rounded-lg bg-warning-soft px-2.5 py-2 text-[11px] leading-relaxed text-warning ring-1 ring-warning/15">
          <span className="font-bold">{t("discovery.watchOut")}: </span>
          {t(`discovery.risks.${risk}`)}
        </div>
      ) : null}
    </div>
  );
}

function sectorLabel(
  sector: string | null | undefined,
  t: ReturnType<typeof useTranslations>
) {
  if (!sector) return t("sectorMix.unknown");
  const translationKey = SECTOR_TRANSLATION_KEYS[sector];
  return translationKey ? t(`sectorNames.${translationKey}`) : sector;
}

function formatPercentage(count: number, total: number) {
  if (total <= 0) return "0";
  const percentage = (count / total) * 100;
  return percentage >= 10 ? percentage.toFixed(0) : percentage.toFixed(1);
}

function SmaPill({
  above,
  below,
  aboveLabel,
  belowLabel,
  missingLabel,
}: {
  above: boolean | null;
  below: boolean | null;
  aboveLabel: string;
  belowLabel: string;
  missingLabel: string;
}) {
  if (above) {
    return (
      <span
        className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success ring-1 ring-success/20 dark:border dark:border-[#4fb97f]/28 dark:bg-[#183528] dark:text-[#8ee0b2]"
        title={aboveLabel}
      >
        ↑
        <span className="sr-only">{aboveLabel}</span>
      </span>
    );
  }
  if (below) {
    return (
      <span
        className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger ring-1 ring-danger/20 dark:border dark:border-[#d77d7d]/28 dark:bg-[#3a1f24] dark:text-[#ffb0a8]"
        title={belowLabel}
      >
        ↓
        <span className="sr-only">{belowLabel}</span>
      </span>
    );
  }
  return <span className="text-text-muted" title={missingLabel}>—<span className="sr-only">{missingLabel}</span></span>;
}

function SignalBadge({ row }: { row: ScreenerResultRow }) {
  const t = useTranslations("screener");

  if (row.strong_buy_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success ring-1 ring-success/15 dark:border dark:border-[#4fb97f]/30 dark:bg-[#183528] dark:text-[#8ee0b2]">
        ▲▲ {t("workspace.cards.strongBullish")}
      </span>
    );
  }
  if (row.buy_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success ring-1 ring-success/15 dark:border dark:border-[#4fb97f]/30 dark:bg-[#183528] dark:text-[#8ee0b2]">
        ▲ {t("workspace.cards.bullishBreak")}
      </span>
    );
  }
  if (row.strong_sell_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger ring-1 ring-danger/15 dark:border dark:border-[#d77d7d]/30 dark:bg-[#3a1f24] dark:text-[#ffb0a8]">
        ▼▼ {t("workspace.cards.strongBearish")}
      </span>
    );
  }
  if (row.sell_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger ring-1 ring-danger/15 dark:border dark:border-[#d77d7d]/30 dark:bg-[#3a1f24] dark:text-[#ffb0a8]">
        ▼ {t("workspace.cards.bearishBreak")}
      </span>
    );
  }
  if (row.bullish_sequence_active) {
    return (
      <span className="text-[11px] font-bold uppercase tracking-wide text-success">
        {t("workspace.matrix.upSequence", { count: row.up_sequence_count })}
      </span>
    );
  }
  if (row.bearish_sequence_active) {
    return (
      <span className="text-[11px] font-bold uppercase tracking-wide text-danger">
        {t("workspace.matrix.downSequence", { count: row.down_sequence_count })}
      </span>
    );
  }
  return <span className="text-[11px] text-text-muted">—</span>;
}

function snapshotMatrixTone(snapshot: ScannerResultSnapshot | null | undefined) {
  if (!snapshot) return "border-border bg-surface-elevated text-text-muted";
  if (snapshot.strong_buy_signal || snapshot.buy_signal || snapshot.bullish_sequence_active) {
    return "border-success/30 bg-success-soft text-success dark:border-[#4fb97f]/30 dark:bg-[#183528] dark:text-[#8ee0b2]";
  }
  if (snapshot.strong_sell_signal || snapshot.sell_signal || snapshot.bearish_sequence_active) {
    return "border-danger/30 bg-danger-soft text-danger dark:border-[#d77d7d]/30 dark:bg-[#3a1f24] dark:text-[#ffb0a8]";
  }
  return "border-border-strong bg-surface-alt text-text-secondary";
}

function snapshotMatrixLabel(
  snapshot: ScannerResultSnapshot | null | undefined,
  t: ReturnType<typeof useTranslations>
) {
  if (!snapshot) return t("workspace.matrix.missing");
  if (snapshot.strong_buy_signal) return t("workspace.matrix.strongBullish");
  if (snapshot.buy_signal) return t("workspace.matrix.bullish");
  if (snapshot.strong_sell_signal) return t("workspace.matrix.strongBearish");
  if (snapshot.sell_signal) return t("workspace.matrix.bearish");
  if (snapshot.bullish_sequence_active) {
    return t("workspace.matrix.upSequence", { count: snapshot.up_sequence_count });
  }
  if (snapshot.bearish_sequence_active) {
    return t("workspace.matrix.downSequence", { count: snapshot.down_sequence_count });
  }
  if (snapshot.is_above_sma50) return t("workspace.matrix.above50");
  if (snapshot.is_below_sma50) return t("workspace.matrix.below50");
  return t("workspace.matrix.neutral");
}

function MatrixCell({
  timeframe,
  snapshot,
}: {
  timeframe: ScreenerTimeframe;
  snapshot: ScannerResultSnapshot | null | undefined;
}) {
  const t = useTranslations("screener");
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {t(`timeframes.${timeframe}`)}
      </p>
      <div
        className={clsx(
          "rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
          snapshotMatrixTone(snapshot)
        )}
      >
        {snapshotMatrixLabel(snapshot, t)}
      </div>
    </div>
  );
}

function describeRule(rule: ScreenerRule, t: ReturnType<typeof useTranslations>): string {
  const definitions = ruleDefinitionsByField();
  const definition = definitions[rule.field];
  const label = t(definition.labelKey);
  if (typeof rule.value === "number") {
    return `${label} ${t(`operators.${rule.operator}`)} ${rule.value}`;
  }
  if (typeof rule.value === "string" && definition.input === "select") {
    return `${label} ${t("operators.eq")} ${t(`fibZones.${rule.value}`)}`;
  }
  return label;
}

export function ResultsTable({
  rows,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  sortKey,
  sortDir,
  onSortChange,
  screenerFilters,
  totalCount,
  sectorBreakdown,
  lastUpdatedLabel,
  onEditFilters,
}: ResultsTableProps) {
  const t = useTranslations("screener");
  const [density, setDensity] = useState<DensityMode>("compact");
  const [expandedTickers, setExpandedTickers] = useState<Record<string, boolean>>({});
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  function toggleExpanded(ticker: string) {
    setExpandedTickers((current) => ({
      ...current,
      [ticker]: !current[ticker],
    }));
  }

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !loadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: "320px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, onLoadMore, rows.length]);

  const tickerQuery =
    screenerFilters && countActiveFilters(screenerFilters) > 0
      ? screenToQueryString(screenerFilters)
      : "";

  const resultSummary = useMemo(() => {
    const bullish = rows.filter((row) => row.buy_signal || row.strong_buy_signal).length;
    const bearish = rows.filter((row) => row.sell_signal || row.strong_sell_signal).length;
    const risks = rows.filter((row) => (row.risk_flags?.length ?? 0) > 0).length;
    const atrValues = rows
      .map((row) => row.atr_percent)
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b);
    const midpoint = Math.floor(atrValues.length / 2);
    const medianAtr = atrValues.length === 0
      ? null
      : atrValues.length % 2 === 0
        ? (atrValues[midpoint - 1] + atrValues[midpoint]) / 2
        : atrValues[midpoint];
    return { bullish, bearish, risks, medianAtr };
  }, [rows]);

  const effectiveSectorBreakdown = useMemo(() => {
    if (sectorBreakdown && sectorBreakdown.length > 0) return sectorBreakdown;
    const counts = new Map<string | null, number>();
    for (const row of rows) {
      const sector = row.sector?.trim() || null;
      counts.set(sector, (counts.get(sector) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count || (a.sector ?? "").localeCompare(b.sector ?? ""));
  }, [rows, sectorBreakdown]);

  const matchedCount = totalCount ?? rows.length;
  const leadingSectorPercentage = matchedCount > 0
    ? ((effectiveSectorBreakdown[0]?.count ?? 0) / matchedCount) * 100
    : 0;
  const sectorSegments = useMemo(() => {
    const visible = effectiveSectorBreakdown.slice(0, 4).map((item) => ({
      ...item,
      isOther: false,
    }));
    const otherCount = effectiveSectorBreakdown
      .slice(4)
      .reduce((sum, item) => sum + item.count, 0);
    if (otherCount > 0) {
      visible.push({ sector: null, count: otherCount, isOther: true });
    }
    return visible;
  }, [effectiveSectorBreakdown]);

  const groupedRules = useMemo(() => {
    const initial: Record<ScreenerTimeframe, ScreenerRule[]> = {
      "1D": [],
      "1W": [],
      "1M": [],
    };
    for (const rule of screenerFilters?.rules ?? []) {
      initial[rule.timeframe].push(rule);
    }
    return initial;
  }, [screenerFilters]);

  const densityRowClass = density === "compact" ? "px-3 py-2" : "px-3 py-3";
  const densityTickerClass = density === "compact" ? "px-4 py-2" : "px-4 py-3";

  if (loading) {
    return (
      <div className="ui-panel overflow-hidden rounded-2xl" role="status" aria-live="polite">
        <span className="sr-only">{t("workspace.loadingResults")}</span>
        <div className="border-b border-border bg-surface-alt/60 px-4 py-4">
          <div className="h-4 w-44 animate-pulse rounded-full bg-surface-accent" />
          <div className="mt-2 h-3 w-72 max-w-full animate-pulse rounded-full bg-surface-accent/70" />
        </div>
        <div className="divide-y divide-border" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[100px_1fr_90px] gap-4 px-4 py-4">
              <div className="h-4 animate-pulse rounded-full bg-surface-accent" />
              <div className="h-4 animate-pulse rounded-full bg-surface-accent/75" />
              <div className="h-4 animate-pulse rounded-full bg-surface-accent/60" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="ui-panel flex min-h-[420px] items-center justify-center rounded-2xl">
        <div className="space-y-2 text-center">
          <p className="text-sm font-bold text-text">{t("symbols", { count: 0 })}</p>
          <p className="text-sm text-text-muted">{t("activeFiltersEmpty")}</p>
        </div>
      </div>
    );
  }

  const activeScanSummary = (["1D", "1W", "1M"] as ScreenerTimeframe[])
    .map((timeframe) => {
      const rules = groupedRules[timeframe];
      if (rules.length === 0) return null;
      return {
        timeframe,
        labels: rules.map((rule) => describeRule(rule, t)),
      };
    })
    .filter(Boolean) as { timeframe: ScreenerTimeframe; labels: string[] }[];

  return (
    <section className="space-y-3" aria-live="polite" aria-busy={loadingMore}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-text">{t("symbols", { count: matchedCount })}</h2>
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary className="ui-control inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-[11px] font-bold text-text-secondary [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true">≡</span>
              {t("workspace.activeFilterButton", { count: countActiveFilters(screenerFilters ?? { version: 1, rules: [] }) })}
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="ui-panel-overlay absolute end-0 top-11 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-text">{t("workspace.filterSummaryTitle")}</p>
                {onEditFilters ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      onEditFilters();
                    }}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    {t("workspace.editFilters")}
                  </button>
                ) : null}
              </div>
              {(screenerFilters?.listing_market || screenerFilters?.market_cap_gte !== undefined || screenerFilters?.market_cap_lte !== undefined) ? (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.sections.universe")}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                    {[
                      screenerFilters?.listing_market ? t(`listingMarket.${screenerFilters.listing_market.toLowerCase()}`) : null,
                      screenerFilters?.market_cap_gte !== undefined ? `${t("marketCap.gte")} ${screenerFilters.market_cap_gte}` : null,
                      screenerFilters?.market_cap_lte !== undefined ? `${t("marketCap.lte")} ${screenerFilters.market_cap_lte}` : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ) : null}
              {activeScanSummary.map((block) => (
                <div key={block.timeframe} className="mt-3 border-t border-border pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t(`timeframes.${block.timeframe}`)}</p>
                  <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-text-secondary">
                    {block.labels.map((label) => <li key={label}>• {label}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </details>
          <details className="relative">
            <summary
              className="ui-control inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-sm text-text-secondary [&::-webkit-details-marker]:hidden"
              aria-label={t("workspace.displaySettings")}
            >
              <span aria-hidden="true">⚙</span>
            </summary>
            <div className="ui-panel-overlay absolute end-0 top-11 z-30 w-44 rounded-2xl p-2">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.density")}</p>
              {(["comfortable", "compact"] as DensityMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDensity(mode)}
                  aria-pressed={density === mode}
                  className={clsx(
                    "min-h-9 w-full rounded-xl px-2 text-start text-xs font-semibold",
                    density === mode ? "bg-primary-soft text-primary" : "text-text-secondary hover:bg-surface-hover"
                  )}
                >
                  {t(`workspace.density.${mode}`)}
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>

      <div className="ui-panel-subtle flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{t("insights.medianAtr")}</span>
          <span className="text-sm font-bold tabular-nums text-text">{resultSummary.medianAtr == null ? "—" : `${fmt(resultSummary.medianAtr, 1)}%`}</span>
        </div>
        <div className="h-4 w-px bg-border" aria-hidden="true" />
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{t("insights.riskFlags")}</span>
          <span className={clsx("text-sm font-bold tabular-nums", resultSummary.risks > 0 ? "text-warning" : "text-success")}>{resultSummary.risks}</span>
        </div>
        {!screenerFilters?.discovery_goal ? (
          <>
            <div className="h-4 w-px bg-border" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-success">{resultSummary.bullish} {t("workspace.cards.bullish")}</span>
            <span className="text-[11px] font-semibold text-danger">{resultSummary.bearish} {t("workspace.cards.bearish")}</span>
          </>
        ) : null}
        <span className="ms-auto text-[10px] text-text-muted">{t("workspace.statusUpdated")} {lastUpdatedLabel ?? rows[0]?.last_trade_date ?? "—"}</span>
      </div>

      {sectorSegments.length > 0 ? (
        <details
          className="ui-panel-subtle group rounded-2xl px-4 py-3"
          aria-label={t("sectorMix.title")}
        >
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                {t("sectorMix.title")}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-text">
                {t("sectorMix.leader", {
                  sector: sectorLabel(effectiveSectorBreakdown[0]?.sector, t),
                  percentage: formatPercentage(
                    effectiveSectorBreakdown[0]?.count ?? 0,
                    matchedCount
                  ),
                })}
              </p>
              </div>
              <span className={clsx(
                "hidden items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:inline-flex",
                leadingSectorPercentage >= 50
                  ? "bg-warning-soft text-warning ring-1 ring-warning/15"
                  : "bg-success-soft text-success ring-1 ring-success/15"
              )}>
                <span aria-hidden="true">{leadingSectorPercentage >= 50 ? "!" : "✓"}</span>
                {leadingSectorPercentage >= 50
                  ? t("sectorMix.concentrated")
                  : t("sectorMix.diversified")}
              </span>
              <div className="hidden h-2 w-36 overflow-hidden rounded-full bg-surface-hover md:flex" aria-hidden="true">
                {sectorSegments.map((item, index) => (
                  <span key={`${item.isOther ? "other" : item.sector ?? "unknown"}-${index}`} className={clsx("h-full", SECTOR_COLORS[index % SECTOR_COLORS.length])} style={{ width: `${(item.count / Math.max(matchedCount, 1)) * 100}%` }} />
                ))}
              </div>
              <span className="text-text-muted transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
            </div>
          </summary>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-hover" aria-hidden="true">
              {sectorSegments.map((item, index) => (
                <span key={`${item.isOther ? "other" : item.sector ?? "unknown"}-${index}-detail`} className={clsx("h-full", SECTOR_COLORS[index % SECTOR_COLORS.length])} style={{ width: `${(item.count / Math.max(matchedCount, 1)) * 100}%` }} />
              ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {sectorSegments.map((item, index) => {
              const label = item.isOther
                ? t("sectorMix.other")
                : sectorLabel(item.sector, t);
              return (
                <div
                  key={`${item.isOther ? "other" : item.sector ?? "unknown"}-legend`}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span
                    className={clsx(
                      "h-2.5 w-2.5 rounded-full",
                      SECTOR_COLORS[index % SECTOR_COLORS.length]
                    )}
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-text">{label}</span>
                  <span className="tabular-nums text-text-muted">
                    {formatPercentage(item.count, matchedCount)}% · {item.count}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-text-muted">{t("sectorMix.basedOn", { count: matchedCount })}</p>
        </details>
      ) : null}

      <div className="ui-table-shell overflow-hidden rounded-[20px]">
      <div className="divide-y divide-border lg:hidden">
        {rows.map((row) => {
          const expanded = !!expandedTickers[row.ticker];
          return (
            <div key={row.ticker} className="bg-surface-raised">
              <button
                type="button"
                onClick={() => toggleExpanded(row.ticker)}
                className="flex min-h-[76px] w-full items-center justify-between gap-2.5 px-3 py-3 text-start transition-colors hover:bg-surface-hover/70 sm:px-4"
                aria-expanded={expanded}
                aria-controls={`mobile-result-${row.ticker}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold tracking-[0.01em] text-text">{row.ticker}</p>
                    <span
                      className="ui-badge-default rounded-full px-2 py-0.5 text-[10px] font-semibold text-text-secondary"
                      title={row.industry ?? undefined}
                    >
                      {sectorLabel(row.sector, t)}
                    </span>
                  </div>
                  {row.company_name ? (
                    <p className="mt-1 truncate text-xs font-medium text-text-secondary">{row.company_name}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-text-muted">{row.last_trade_date}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex flex-col items-end gap-1.5 text-end">
                  {screenerFilters?.discovery_goal ? <MatchScoreBadge score={row.match_score} /> : null}
                  <SignalBadge row={row} />
                  </div>
                  <span
                    className={clsx(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-alt text-text-muted transition-transform",
                      expanded && "rotate-180"
                    )}
                    aria-hidden="true"
                  >
                    ⌄
                  </span>
                </div>
              </button>

              {expanded ? (
                <div id={`mobile-result-${row.ticker}`} className="space-y-3 border-t border-border bg-surface-alt/65 px-3 py-3.5 sm:px-4">
                  <MatchExplanation row={row} guided={!!screenerFilters?.discovery_goal} />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="ui-control rounded-lg px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                        {t("table.close")}
                      </p>
                      <p className="mt-1 font-bold text-text">{fmt(row.close)}</p>
                    </div>
                    <div className="ui-control rounded-lg px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                        {t("table.atrPct")}
                      </p>
                      <p className="mt-1 font-bold text-text">{fmt(row.atr_percent)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <MatrixCell timeframe="1D" snapshot={row.timeframe_snapshots?.["1D"] ?? row} />
                    <MatrixCell timeframe="1W" snapshot={row.timeframe_snapshots?.["1W"] ?? null} />
                    <MatrixCell timeframe="1M" snapshot={row.timeframe_snapshots?.["1M"] ?? null} />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="ui-control rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">20</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} aboveLabel={t("accessibility.aboveSma", { period: 20 })} belowLabel={t("accessibility.belowSma", { period: 20 })} missingLabel={t("accessibility.noData")} /></div>
                    </div>
                    <div className="ui-control rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">50</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} aboveLabel={t("accessibility.aboveSma", { period: 50 })} belowLabel={t("accessibility.belowSma", { period: 50 })} missingLabel={t("accessibility.noData")} /></div>
                    </div>
                    <div className="ui-control rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">150</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} aboveLabel={t("accessibility.aboveSma", { period: 150 })} belowLabel={t("accessibility.belowSma", { period: 150 })} missingLabel={t("accessibility.noData")} /></div>
                    </div>
                    <div className="ui-control rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">200</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} aboveLabel={t("accessibility.aboveSma", { period: 200 })} belowLabel={t("accessibility.belowSma", { period: 200 })} missingLabel={t("accessibility.noData")} /></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={tradingViewFullChartUrlForTicker(row.ticker, row.market)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-control inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text"
                    >
                      {t("workspace.openTradingView")}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 opacity-60" aria-hidden="true">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </a>
                    <Link
                      href={`/ticker/${row.ticker}${tickerQuery}`}
                      className="ui-control inline-flex min-w-0 items-center justify-center rounded-lg px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text"
                    >
                      {t("workspace.openTicker")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-sm">
          <caption className="sr-only">{t("accessibility.resultsCaption", { count: matchedCount })}</caption>
          <thead className="ui-table-header sticky top-0 z-10 backdrop-blur">
            <tr className="border-b border-border/80 text-start">
              <th
                scope="col"
                aria-sort={sortKey === "ticker" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                className="px-4 py-2.5 text-start text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary"
              >
                <button type="button" onClick={() => onSortChange("ticker")} className="link-hover inline-flex min-h-8 items-center gap-1">
                  {t("table.ticker")}
                  {sortKey === "ticker" ? (sortDir === "asc" ? "↑" : "↓") : null}
                </button>
              </th>
              <th
                scope="col"
                aria-sort={screenerFilters?.discovery_goal && sortKey === "match_score" ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                className="px-3 py-2.5 text-start text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary"
              >
                {screenerFilters?.discovery_goal ? (
                  <button type="button" onClick={() => onSortChange("match_score")} className="link-hover inline-flex min-h-8 items-center gap-1">
                    {t("table.matchScore")}
                    {sortKey === "match_score" ? (sortDir === "asc" ? "↑" : "↓") : null}
                  </button>
                ) : t("discovery.notableContext")}
              </th>
              <th scope="col" className="px-3 py-2.5 text-start text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                {t("table.sector")}
              </th>
              <th scope="col" aria-sort={sortKey === "close" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2.5 text-end text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                <button type="button" onClick={() => onSortChange("close")} className="link-hover inline-flex min-h-8 items-center gap-1">
                  {t("table.close")}
                  {sortKey === "close" ? (sortDir === "asc" ? "↑" : "↓") : null}
                </button>
              </th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("table.sma20")}</th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("table.sma50")}</th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("table.sma150")}</th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("table.sma200")}</th>
              <th scope="col" aria-sort={sortKey === "atr_percent" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2.5 text-end text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                <button type="button" onClick={() => onSortChange("atr_percent")} className="link-hover inline-flex min-h-8 items-center gap-1">
                  {t("table.atrPct")}
                  {sortKey === "atr_percent" ? (sortDir === "asc" ? "↑" : "↓") : null}
                </button>
              </th>
              <th scope="col" className="px-3 py-2.5 text-start text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("table.seqState")}</th>
              <th scope="col" className="px-3 py-2.5 text-start text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("workspace.columns.matrix")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.ticker} className="ui-table-row align-top transition-colors">
                <td className={densityTickerClass}>
                  <div className="flex flex-col gap-1">
                    <a
                      href={tradingViewFullChartUrlForTicker(row.ticker, row.market)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t("workspace.openTradingView")}
                      className="link-hover inline-flex w-fit items-center gap-1 font-bold tracking-[0.01em] text-text decoration-[color:var(--color-neon)]/40 underline-offset-2 hover:underline"
                    >
                      {row.ticker}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3 w-3 opacity-50"
                        aria-hidden="true"
                      >
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </a>
                    {row.company_name ? (
                      <span className="max-w-[180px] truncate text-[11px] font-medium text-text-secondary" title={row.company_name}>
                        {row.company_name}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-text-muted">{row.last_trade_date}</span>
                  </div>
                </td>
                <td className={clsx(densityRowClass, "min-w-[220px]")}>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {screenerFilters?.discovery_goal ? <MatchScoreBadge score={row.match_score} /> : null}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(row.ticker)}
                        aria-expanded={!!expandedTickers[row.ticker]}
                        aria-controls={`match-context-${row.ticker}`}
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-primary hover:bg-primary-soft"
                      >
                        {expandedTickers[row.ticker] ? t("workspace.hideWhyMatched") : t("workspace.showWhyMatched")}
                        <span className={clsx("transition-transform", expandedTickers[row.ticker] && "rotate-180")} aria-hidden="true">⌄</span>
                      </button>
                    </div>
                    {expandedTickers[row.ticker] ? (
                      <div id={`match-context-${row.ticker}`}>
                        <MatchExplanation row={row} guided={!!screenerFilters?.discovery_goal} />
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className={clsx(densityRowClass, "min-w-[130px]")}>
                  <span
                    className="ui-badge-default inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold text-text-secondary"
                    title={row.industry ?? undefined}
                  >
                    {sectorLabel(row.sector, t)}
                  </span>
                </td>
                <td className={clsx(densityRowClass, "text-end tabular-nums font-semibold text-text")}>{fmt(row.close)}</td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} aboveLabel={t("accessibility.aboveSma", { period: 20 })} belowLabel={t("accessibility.belowSma", { period: 20 })} missingLabel={t("accessibility.noData")} /></td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} aboveLabel={t("accessibility.aboveSma", { period: 50 })} belowLabel={t("accessibility.belowSma", { period: 50 })} missingLabel={t("accessibility.noData")} /></td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} aboveLabel={t("accessibility.aboveSma", { period: 150 })} belowLabel={t("accessibility.belowSma", { period: 150 })} missingLabel={t("accessibility.noData")} /></td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} aboveLabel={t("accessibility.aboveSma", { period: 200 })} belowLabel={t("accessibility.belowSma", { period: 200 })} missingLabel={t("accessibility.noData")} /></td>
                <td className={clsx(densityRowClass, "text-end tabular-nums text-[12px] text-text-secondary")}>{fmt(row.atr_percent)}</td>
                <td className={densityRowClass}>
                  <SignalBadge row={row} />
                </td>
                <td className={clsx(densityRowClass, "min-w-[250px]")}>
                  <div className="grid grid-cols-3 gap-2">
                    <MatrixCell timeframe="1D" snapshot={row.timeframe_snapshots?.["1D"] ?? row} />
                    <MatrixCell timeframe="1W" snapshot={row.timeframe_snapshots?.["1W"] ?? null} />
                    <MatrixCell timeframe="1M" snapshot={row.timeframe_snapshots?.["1M"] ?? null} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
      {(loadingMore || hasMore) && (
        <div ref={loadMoreRef} className="flex justify-center py-3">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <span>{t("results")}…</span>
            </div>
          ) : (
            <div className="h-4" aria-hidden="true" />
          )}
        </div>
      )}
    </section>
  );
}
