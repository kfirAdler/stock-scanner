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
      <span className="inline-flex items-center gap-1 rounded-full border border-success/35 bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
        ▲▲ {t("workspace.cards.strongBullish")}
      </span>
    );
  }
  if (row.buy_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/35 bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
        ▲ {t("workspace.cards.bullishBreak")}
      </span>
    );
  }
  if (row.strong_sell_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-danger/35 bg-danger-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger">
        ▼▼ {t("workspace.cards.strongBearish")}
      </span>
    );
  }
  if (row.sell_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-danger/35 bg-danger-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger">
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
  if (!snapshot) return "border-border bg-surface text-text-muted";
  if (snapshot.strong_buy_signal || snapshot.buy_signal || snapshot.bullish_sequence_active) {
    return "border-success/30 bg-success-soft text-success";
  }
  if (snapshot.strong_sell_signal || snapshot.sell_signal || snapshot.bearish_sequence_active) {
    return "border-danger/30 bg-danger-soft text-danger";
  }
  return "border-border-strong bg-surface-alt text-text-secondary";
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

  const densityRowClass = density === "compact" ? "px-3 py-2.5" : "px-3 py-3.5";
  const densityTickerClass = density === "compact" ? "px-4 py-2.5" : "px-4 py-3.5";

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-surface-raised">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/25 border-t-primary" role="status" />
          <span className="text-sm font-medium text-text-muted">{t("results")}…</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-surface-raised">
        <div className="space-y-2 text-center">
          <p className="text-sm font-bold text-text">{t("symbols", { count: 0 })}</p>
          <p className="text-sm text-text-muted">{t("activeFiltersEmpty")}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border-strong/70 bg-surface-raised shadow-[0_14px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
      <div className="border-b border-border bg-surface-alt/80 px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("results")}
            </p>
            <h2 className="mt-1 text-lg font-bold text-text">{t("symbols", { count: rows.length })}</h2>
            <p className="mt-1 text-xs text-text-secondary">{t("workspace.resultBody")}</p>

            <div className="mt-4 rounded-xl border border-border bg-surface-raised px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                    {t("workspace.activeScan")}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">{t("workspace.activeScanHint")}</p>
                </div>
                <div className="inline-flex items-center rounded-xl border border-border bg-surface p-1">
                  <button
                    type="button"
                    onClick={() => setDensity("comfortable")}
                    className={clsx(
                      "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                      density === "comfortable" ? "bg-primary text-on-primary" : "text-text-secondary hover:text-text"
                    )}
                  >
                    {t("workspace.density.comfortable")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensity("compact")}
                    className={clsx(
                      "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                      density === "compact" ? "bg-primary text-on-primary" : "text-text-secondary hover:text-text"
                    )}
                  >
                    {t("workspace.density.compact")}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {(["1D", "1W", "1M"] as ScreenerTimeframe[]).map((timeframe) => (
                  <div key={timeframe} className="rounded-lg border border-border bg-surface px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                      {t(`timeframes.${timeframe}`)}
                    </p>
                    {groupedRules[timeframe].length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                        {groupedRules[timeframe].map((rule) => (
                          <li key={rule.id}>{describeRule(rule, t)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-text-muted">{t("workspace.noRulesForTimeframe")}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 xl:min-w-[300px]">
            <div className="rounded-xl border border-border bg-surface-alt/70 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {t("workspace.cards.bullish")}
              </p>
              <p className="mt-1 text-lg font-bold text-success">{resultSummary.bullish}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-alt/70 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {t("workspace.cards.bearish")}
              </p>
              <p className="mt-1 text-lg font-bold text-danger">{resultSummary.bearish}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-alt/70 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {t("workspace.cards.strong")}
              </p>
              <p className="mt-1 text-lg font-bold text-primary">{resultSummary.strong}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border lg:hidden">
        {sorted.map((row) => {
          const expanded = !!expandedTickers[row.ticker];
          return (
            <div key={row.ticker} className="bg-surface-raised">
              <button
                type="button"
                onClick={() => toggleExpanded(row.ticker)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-alt/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">{row.ticker}</p>
                  <p className="mt-1 text-[11px] text-text-muted">{row.last_trade_date}</p>
                </div>
                <div className="text-right">
                  <SignalBadge row={row} />
                </div>
              </button>

              {expanded ? (
                <div className="space-y-3 border-t border-border bg-surface-alt/60 px-4 py-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-border bg-surface px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                        {t("table.close")}
                      </p>
                      <p className="mt-1 font-bold text-text">{fmt(row.close)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface px-3 py-3">
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
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">20</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} /></div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">50</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} /></div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">150</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} /></div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">200</p>
                      <div className="mt-1"><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} /></div>
                    </div>
                  </div>

                  <Link
                    href={`/ticker/${row.ticker}${tickerQuery}`}
                    className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text"
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
          <thead className="sticky top-0 z-10 bg-surface-alt">
            <tr className="border-b border-border text-start">
              <th scope="col" className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                <button onClick={() => handleSort("ticker")} className="inline-flex items-center gap-1 transition-colors hover:text-text">
                  {t("table.ticker")}
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                <button onClick={() => handleSort("close")} className="inline-flex items-center gap-1 transition-colors hover:text-text">
                  {t("table.close")}
                </button>
              </th>
              <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma20")}</th>
              <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma50")}</th>
              <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma150")}</th>
              <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma200")}</th>
              <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                <button onClick={() => handleSort("atr_percent")} className="inline-flex items-center gap-1 transition-colors hover:text-text">
                  {t("table.atrPct")}
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-start text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.seqState")}</th>
              <th scope="col" className="px-3 py-3 text-start text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.columns.matrix")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row) => (
              <tr key={row.ticker} className="align-top transition-colors hover:bg-surface-alt/50">
                <td className={densityTickerClass}>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/ticker/${row.ticker}${tickerQuery}`}
                      className="font-bold text-primary hover:underline decoration-primary/30 underline-offset-2"
                    >
                      {row.ticker}
                    </Link>
                    <span className="text-[11px] text-text-muted">{row.last_trade_date}</span>
                  </div>
                </td>
                <td className={clsx(densityRowClass, "text-end tabular-nums font-bold text-text")}>{fmt(row.close)}</td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} /></td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} /></td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} /></td>
                <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} /></td>
                <td className={clsx(densityRowClass, "text-end tabular-nums text-text-secondary")}>{fmt(row.atr_percent)}</td>
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
    </section>
  );
}
