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
}

function fmt(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

function SmaPill({ above, below }: { above: boolean | null; below: boolean | null }) {
  if (above) {
    return (
      <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">
        ↑
      </span>
    );
  }
  if (below) {
    return (
      <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger">
        ↓
      </span>
    );
  }
  return <span className="text-text-muted">—</span>;
}

function SignalBadge({ row }: { row: ScreenerResultRow }) {
  const t = useTranslations("screener");

  if (row.strong_buy_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success ring-1 ring-success/15">
        ▲▲ {t("workspace.cards.strongBullish")}
      </span>
    );
  }
  if (row.buy_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success ring-1 ring-success/15">
        ▲ {t("workspace.cards.bullishBreak")}
      </span>
    );
  }
  if (row.strong_sell_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger ring-1 ring-danger/15">
        ▼▼ {t("workspace.cards.strongBearish")}
      </span>
    );
  }
  if (row.sell_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger ring-1 ring-danger/15">
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
    return "border-success/30 bg-success-soft text-success";
  }
  if (snapshot.strong_sell_signal || snapshot.sell_signal || snapshot.bearish_sequence_active) {
    return "border-danger/30 bg-danger-soft text-danger";
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
    const strong = rows.filter((row) => row.strong_buy_signal || row.strong_sell_signal).length;
    return { bullish, bearish, strong };
  }, [rows]);

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
      <div className="ui-panel flex min-h-[420px] items-center justify-center rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/25 border-t-primary" role="status" />
          <span className="text-sm font-medium text-text-muted">{t("results")}…</span>
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
    <section className="space-y-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold text-text">{t("symbols", { count: rows.length })}</h2>
            {activeScanSummary.map((block) => (
              <span
                key={block.timeframe}
                className="ui-badge-default inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
              >
                <span className="font-semibold text-text">{t(`timeframes.${block.timeframe}`)}</span>
                <span className="truncate text-text-secondary">{block.labels.join(" · ")}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success ring-1 ring-success/15">
            {resultSummary.bullish} {t("workspace.cards.bullish")}
          </span>
          <span className="rounded-full bg-danger-soft px-2.5 py-1 text-[11px] font-semibold text-danger ring-1 ring-danger/15">
            {resultSummary.bearish} {t("workspace.cards.bearish")}
          </span>
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/10">
            {resultSummary.strong} {t("workspace.cards.strong")}
          </span>
          <div className="ui-segment inline-flex items-center rounded-full p-1">
            <button
              type="button"
              onClick={() => setDensity("comfortable")}
              className={clsx(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                density === "comfortable" ? "ui-segment-item-active" : "ui-segment-item hover:text-text"
              )}
            >
              {t("workspace.density.comfortable")}
            </button>
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={clsx(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                density === "compact" ? "ui-segment-item-active" : "ui-segment-item hover:text-text"
              )}
            >
              {t("workspace.density.compact")}
            </button>
          </div>
        </div>
      </div>

      <div className="ui-table-shell overflow-hidden rounded-[20px]">
      <div className="divide-y divide-border lg:hidden">
        {rows.map((row) => {
          const expanded = !!expandedTickers[row.ticker];
          return (
            <div key={row.ticker} className="bg-surface-raised">
              <button
                type="button"
                onClick={() => toggleExpanded(row.ticker)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover/70"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-[0.01em] text-text">{row.ticker}</p>
                  <p className="mt-1 text-[11px] text-text-muted">{row.last_trade_date}</p>
                </div>
                <div className="text-right">
                  <SignalBadge row={row} />
                </div>
              </button>

              {expanded ? (
                <div className="space-y-3 border-t border-border bg-surface-alt/65 px-4 py-3.5">
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
                      <div className="mt-1"><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} /></div>
                    </div>
                    <div className="ui-control rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">50</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} /></div>
                    </div>
                    <div className="ui-control rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">150</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} /></div>
                    </div>
                    <div className="ui-control rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">200</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} /></div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={tradingViewFullChartUrlForTicker(row.ticker, row.market)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-control inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text"
                    >
                      {t("workspace.openTradingView")}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 opacity-60" aria-hidden="true">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </a>
                    <Link
                      href={`/ticker/${row.ticker}${tickerQuery}`}
                      className="ui-control inline-flex items-center rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text"
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
          <thead className="ui-table-header sticky top-0 z-10 backdrop-blur">
            <tr className="border-b border-border/80 text-start">
              <th scope="col" className="px-4 py-2.5 text-start text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                <button onClick={() => onSortChange("ticker")} className="link-hover inline-flex items-center gap-1">
                  {t("table.ticker")}
                  {sortKey === "ticker" ? (sortDir === "asc" ? "↑" : "↓") : null}
                </button>
              </th>
              <th scope="col" className="px-3 py-2.5 text-end text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                <button onClick={() => onSortChange("close")} className="link-hover inline-flex items-center gap-1">
                  {t("table.close")}
                  {sortKey === "close" ? (sortDir === "asc" ? "↑" : "↓") : null}
                </button>
              </th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("table.sma20")}</th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("table.sma50")}</th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("table.sma150")}</th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">{t("table.sma200")}</th>
              <th scope="col" className="px-3 py-2.5 text-end text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                <button onClick={() => onSortChange("atr_percent")} className="link-hover inline-flex items-center gap-1">
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
                    <span className="text-[10px] text-text-muted">{row.last_trade_date}</span>
                  </div>
                </td>
                <td className={clsx(densityRowClass, "text-end tabular-nums font-semibold text-text")}>{fmt(row.close)}</td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} /></td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} /></td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} /></td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} /></td>
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
