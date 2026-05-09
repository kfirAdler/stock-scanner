"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import type {
  ScreenerPayload,
  ScreenerResultRow,
  ScreenerRule,
  ScreenerTimeframe,
  SnapshotRow,
} from "@/lib/screener-types";
import {
  countActiveFilters,
  ruleDefinitionsByField,
  screenToQueryString,
} from "@/lib/screener-query";

type SortKey = "ticker" | "close" | "atr_percent";
type SortDir = "asc" | "desc";
type DensityMode = "comfortable" | "compact";

interface ResultsTableProps {
  rows: ScreenerResultRow[];
  loading?: boolean;
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

function snapshotMatrixTone(snapshot: SnapshotRow | null | undefined) {
  if (!snapshot) return "border-border bg-surface text-text-muted dark:border-white/[0.04] dark:bg-white/[0.03]";
  if (snapshot.strong_buy_signal || snapshot.buy_signal || snapshot.bullish_sequence_active) {
    return "border-success/30 bg-success-soft text-success";
  }
  if (snapshot.strong_sell_signal || snapshot.sell_signal || snapshot.bearish_sequence_active) {
    return "border-danger/30 bg-danger-soft text-danger";
  }
  return "border-border-strong bg-surface-alt text-text-secondary dark:border-white/[0.05] dark:bg-white/[0.035]";
}

function snapshotMatrixLabel(
  snapshot: SnapshotRow | null | undefined,
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
  snapshot: SnapshotRow | null | undefined;
}) {
  const t = useTranslations("screener");
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {t(`timeframes.${timeframe}`)}
      </p>
      <div
        className={clsx(
          "rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-wide",
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

export function ResultsTable({ rows, loading, screenerFilters }: ResultsTableProps) {
  const t = useTranslations("screener");
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [density, setDensity] = useState<DensityMode>("compact");
  const [expandedTickers, setExpandedTickers] = useState<Record<string, boolean>>({});

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function toggleExpanded(ticker: string) {
    setExpandedTickers((current) => ({
      ...current,
      [ticker]: !current[ticker],
    }));
  }

  const tickerQuery =
    screenerFilters && countActiveFilters(screenerFilters) > 0
      ? screenToQueryString(screenerFilters)
      : "";

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortDir, sortKey]);

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
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-surface-raised dark:border-white/[0.05] dark:bg-[linear-gradient(180deg,rgba(20,29,48,0.9),rgba(17,24,39,0.96))]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/25 border-t-primary" role="status" />
          <span className="text-sm font-medium text-text-muted">{t("results")}…</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-surface-raised dark:border-white/[0.05] dark:bg-[linear-gradient(180deg,rgba(20,29,48,0.9),rgba(17,24,39,0.96))]">
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
                className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] text-text-secondary ring-1 ring-border dark:bg-white/[0.04] dark:ring-white/[0.05]"
              >
                <span className="font-semibold text-text">{t(`timeframes.${block.timeframe}`)}</span>
                <span className="truncate">{block.labels.join(" · ")}</span>
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
          <div className="inline-flex items-center rounded-full bg-surface-alt p-1 ring-1 ring-border dark:bg-white/[0.035] dark:ring-white/[0.05]">
            <button
              type="button"
              onClick={() => setDensity("comfortable")}
              className={clsx(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                density === "comfortable" ? "bg-surface-raised text-text shadow-sm ring-1 ring-border dark:bg-white/[0.07] dark:ring-white/[0.06]" : "text-text-muted hover:text-text"
              )}
            >
              {t("workspace.density.comfortable")}
            </button>
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={clsx(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                density === "compact" ? "bg-surface-raised text-text shadow-sm ring-1 ring-border dark:bg-white/[0.07] dark:ring-white/[0.06]" : "text-text-muted hover:text-text"
              )}
            >
              {t("workspace.density.compact")}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] bg-surface-raised shadow-[0_10px_34px_rgba(15,23,42,0.06)] ring-1 ring-border dark:bg-[radial-gradient(circle_at_top,rgba(79,110,247,0.1),transparent_34%),linear-gradient(180deg,rgba(22,32,51,0.98),rgba(15,23,42,0.98))] dark:shadow-[0_24px_64px_rgba(2,6,23,0.5)] dark:ring-white/[0.05]">
      <div className="divide-y divide-border dark:divide-white/[0.04] lg:hidden">
        {sorted.map((row) => {
          const expanded = !!expandedTickers[row.ticker];
          return (
            <div key={row.ticker} className="bg-surface-raised dark:bg-transparent">
              <button
                type="button"
                onClick={() => toggleExpanded(row.ticker)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-alt/55 dark:hover:bg-white/[0.04]"
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
                <div className="space-y-3 border-t border-border bg-surface-alt/45 px-4 py-3.5 dark:border-white/[0.05] dark:bg-white/[0.03]">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-surface px-3 py-2.5 ring-1 ring-border dark:bg-white/[0.035] dark:ring-white/[0.05]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                        {t("table.close")}
                      </p>
                      <p className="mt-1 font-bold text-text">{fmt(row.close)}</p>
                    </div>
                    <div className="rounded-lg bg-surface px-3 py-2.5 ring-1 ring-border dark:bg-white/[0.035] dark:ring-white/[0.05]">
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
                    <div className="rounded-lg bg-surface px-3 py-2 text-center ring-1 ring-border dark:bg-white/[0.035] dark:ring-white/[0.05]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">20</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} /></div>
                    </div>
                    <div className="rounded-lg bg-surface px-3 py-2 text-center ring-1 ring-border dark:bg-white/[0.035] dark:ring-white/[0.05]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">50</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} /></div>
                    </div>
                    <div className="rounded-lg bg-surface px-3 py-2 text-center ring-1 ring-border dark:bg-white/[0.035] dark:ring-white/[0.05]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">150</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} /></div>
                    </div>
                    <div className="rounded-lg bg-surface px-3 py-2 text-center ring-1 ring-border dark:bg-white/[0.035] dark:ring-white/[0.05]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">200</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} /></div>
                    </div>
                  </div>

                  <Link
                    href={`/ticker/${row.ticker}${tickerQuery}`}
                    className="inline-flex items-center rounded-lg bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-secondary ring-1 ring-border transition-colors hover:text-text hover:ring-border-strong dark:bg-white/[0.035] dark:ring-white/[0.05] dark:hover:bg-white/[0.05]"
                  >
                    {t("workspace.openTicker")}
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-alt/92 backdrop-blur dark:bg-[rgba(17,24,39,0.82)]">
            <tr className="border-b border-border/80 text-start dark:border-white/[0.05]">
              <th scope="col" className="px-4 py-2.5 text-start text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                <button onClick={() => handleSort("ticker")} className="inline-flex items-center gap-1 transition-colors hover:text-text">
                  {t("table.ticker")}
                </button>
              </th>
              <th scope="col" className="px-3 py-2.5 text-end text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                <button onClick={() => handleSort("close")} className="inline-flex items-center gap-1 transition-colors hover:text-text">
                  {t("table.close")}
                </button>
              </th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{t("table.sma20")}</th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{t("table.sma50")}</th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{t("table.sma150")}</th>
              <th scope="col" className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{t("table.sma200")}</th>
              <th scope="col" className="px-3 py-2.5 text-end text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                <button onClick={() => handleSort("atr_percent")} className="inline-flex items-center gap-1 transition-colors hover:text-text">
                  {t("table.atrPct")}
                </button>
              </th>
              <th scope="col" className="px-3 py-2.5 text-start text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{t("table.seqState")}</th>
              <th scope="col" className="px-3 py-2.5 text-start text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{t("workspace.columns.matrix")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-white/[0.04]">
            {sorted.map((row) => (
              <tr key={row.ticker} className="align-top transition-colors hover:bg-surface-alt/40 focus-within:bg-surface-alt/55 dark:odd:bg-transparent dark:even:bg-white/[0.02] dark:hover:bg-white/[0.045] dark:focus-within:bg-white/[0.05]">
                <td className={densityTickerClass}>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/ticker/${row.ticker}${tickerQuery}`}
                      className="font-bold tracking-[0.01em] text-text hover:text-primary hover:underline decoration-primary/30 underline-offset-2"
                    >
                      {row.ticker}
                    </Link>
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
    </section>
  );
}
