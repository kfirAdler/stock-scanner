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

type SortKey =
  | "ticker"
  | "close"
  | "atr_percent"
  | "pct_to_bb_upper"
  | "pct_to_bb_lower";
type SortDir = "asc" | "desc";
type DensityMode = "comfortable" | "compact";
type ColumnKey =
  | "close"
  | "sma20"
  | "sma50"
  | "sma150"
  | "sma200"
  | "atrPct"
  | "bbUpper"
  | "bbLower"
  | "signal"
  | "matrix"
  | "whyMatched";

interface ResultsTableProps {
  rows: ScreenerResultRow[];
  loading?: boolean;
  screenerFilters?: ScreenerPayload;
}

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  close: true,
  sma20: true,
  sma50: true,
  sma150: true,
  sma200: true,
  atrPct: true,
  bbUpper: true,
  bbLower: false,
  signal: true,
  matrix: true,
  whyMatched: true,
};

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
  if (row.strong_buy_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
        ▲▲ Strong Bullish
      </span>
    );
  }
  if (row.buy_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
        ▲ Bullish Break
      </span>
    );
  }
  if (row.strong_sell_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger">
        ▼▼ Strong Bearish
      </span>
    );
  }
  if (row.sell_signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger">
        ▼ Bearish Break
      </span>
    );
  }
  if (row.bullish_sequence_active) {
    return (
      <span className="text-[11px] font-bold uppercase tracking-wide text-success">
        Up {row.up_sequence_count}
      </span>
    );
  }
  if (row.bearish_sequence_active) {
    return (
      <span className="text-[11px] font-bold uppercase tracking-wide text-danger">
        Down {row.down_sequence_count}
      </span>
    );
  }
  return <span className="text-[11px] text-text-muted">—</span>;
}

function sortIndicator(active: boolean, dir: SortDir) {
  if (!active) return "";
  return dir === "asc" ? "▲" : "▼";
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

function describeRule(
  rule: ScreenerRule,
  t: ReturnType<typeof useTranslations>
): string {
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

export function ResultsTable({ rows, loading, screenerFilters }: ResultsTableProps) {
  const t = useTranslations("screener");
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [density, setDensity] = useState<DensityMode>("comfortable");
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
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

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((current) => ({
      ...current,
      [key]: !current[key],
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

  const densityRowClass =
    density === "compact" ? "px-3 py-2.5" : "px-3 py-3.5";
  const densityTickerClass =
    density === "compact" ? "px-4 py-2.5" : "px-4 py-3.5";

  const columnItems: { key: ColumnKey; label: string }[] = [
    { key: "close", label: t("workspace.columns.close") },
    { key: "sma20", label: t("workspace.columns.sma20") },
    { key: "sma50", label: t("workspace.columns.sma50") },
    { key: "sma150", label: t("workspace.columns.sma150") },
    { key: "sma200", label: t("workspace.columns.sma200") },
    { key: "atrPct", label: t("workspace.columns.atrPct") },
    { key: "bbUpper", label: t("workspace.columns.bbUpper") },
    { key: "bbLower", label: t("workspace.columns.bbLower") },
    { key: "signal", label: t("workspace.columns.signal") },
    { key: "matrix", label: t("workspace.columns.matrix") },
    { key: "whyMatched", label: t("workspace.columns.whyMatched") },
  ];

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
    <section className="rounded-2xl border border-border-strong/70 bg-surface-raised shadow-[0_14px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_50px_rgba(2,6,23,0.5)]">
      <div className="border-b border-border bg-surface-alt/80 px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("results")}
            </p>
            <h2 className="mt-1 text-lg font-bold text-text">{t("symbols", { count: rows.length })}</h2>
            <p className="mt-1 text-xs text-text-secondary">
              {t("workspace.resultBody")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 xl:min-w-[360px]">
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

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center rounded-xl border border-border bg-surface-raised p-1">
            <button
              type="button"
              onClick={() => setDensity("comfortable")}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                density === "comfortable"
                  ? "bg-primary text-on-primary"
                  : "text-text-secondary hover:text-text"
              )}
            >
              {t("workspace.density.comfortable")}
            </button>
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                density === "compact"
                  ? "bg-primary text-on-primary"
                  : "text-text-secondary hover:text-text"
              )}
            >
              {t("workspace.density.compact")}
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setColumnMenuOpen((current) => !current)}
              className="inline-flex items-center rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text"
            >
              {t("workspace.columns.title")}
            </button>
            {columnMenuOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-border bg-surface-raised p-3 shadow-lg dark:shadow-[0_18px_50px_rgba(2,6,23,0.55)]">
                <div className="grid gap-2">
                  {columnItems.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors hover:border-border-strong hover:bg-surface-alt/70"
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={visibleColumns[item.key]}
                        onChange={() => toggleColumn(item.key)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {sorted.map((row) => {
          const expanded = !!expandedTickers[row.ticker];
          return (
            <article key={row.ticker} className="rounded-xl border border-border bg-surface-raised p-4 shadow-sm dark:shadow-[0_12px_30px_rgba(2,6,23,0.4)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/ticker/${row.ticker}${tickerQuery}`}
                    className="text-base font-bold text-primary hover:underline decoration-primary/30 underline-offset-2"
                  >
                    {row.ticker}
                  </Link>
                  <p className="mt-1 text-[11px] text-text-muted">{row.last_trade_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                    {t("table.close")}
                  </p>
                  <p className="mt-1 text-lg font-bold text-text">{fmt(row.close)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <SignalBadge row={row} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <MatrixCell timeframe="1D" snapshot={row.timeframe_snapshots?.["1D"] ?? row} />
                <MatrixCell timeframe="1W" snapshot={row.timeframe_snapshots?.["1W"] ?? null} />
                <MatrixCell timeframe="1M" snapshot={row.timeframe_snapshots?.["1M"] ?? null} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border bg-surface-alt/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                    {t("table.atrPct")}
                  </p>
                  <p className="mt-1 font-bold text-text">{fmt(row.atr_percent)}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-alt/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                    {t("table.bbLower")}
                  </p>
                  <p className="mt-1 font-bold text-text">{fmt(row.pct_to_bb_lower)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleExpanded(row.ticker)}
                className="mt-4 inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-secondary transition-colors hover:text-text"
              >
                {expanded ? t("workspace.hideWhyMatched") : t("workspace.showWhyMatched")}
              </button>

              {expanded ? (
                <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface-alt/80 p-3">
                  {(["1D", "1W", "1M"] as ScreenerTimeframe[]).map((timeframe) =>
                    groupedRules[timeframe].length > 0 ? (
                      <div key={`${row.ticker}-${timeframe}`}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                          {t(`timeframes.${timeframe}`)}
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                          {groupedRules[timeframe].map((rule) => (
                            <li key={rule.id}>{describeRule(rule, t)}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-alt">
            <tr className="border-b border-border text-start">
              <th scope="col" className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                <button onClick={() => handleSort("ticker")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.ticker")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "ticker" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "ticker", sortDir)}
                  </span>
                </button>
              </th>
              {visibleColumns.close ? (
                <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  <button onClick={() => handleSort("close")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                    {t("table.close")}
                    <span className={clsx("text-[10px] transition-opacity", sortKey === "close" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                      {sortIndicator(sortKey === "close", sortDir)}
                    </span>
                  </button>
                </th>
              ) : null}
              {visibleColumns.sma20 ? <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma20")}</th> : null}
              {visibleColumns.sma50 ? <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma50")}</th> : null}
              {visibleColumns.sma150 ? <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma150")}</th> : null}
              {visibleColumns.sma200 ? <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma200")}</th> : null}
              {visibleColumns.atrPct ? (
                <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  <button onClick={() => handleSort("atr_percent")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                    {t("table.atrPct")}
                    <span className={clsx("text-[10px] transition-opacity", sortKey === "atr_percent" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                      {sortIndicator(sortKey === "atr_percent", sortDir)}
                    </span>
                  </button>
                </th>
              ) : null}
              {visibleColumns.bbUpper ? (
                <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  <button onClick={() => handleSort("pct_to_bb_upper")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                    {t("table.bbUpper")}
                    <span className={clsx("text-[10px] transition-opacity", sortKey === "pct_to_bb_upper" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                      {sortIndicator(sortKey === "pct_to_bb_upper", sortDir)}
                    </span>
                  </button>
                </th>
              ) : null}
              {visibleColumns.bbLower ? (
                <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  <button onClick={() => handleSort("pct_to_bb_lower")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                    {t("table.bbLower")}
                    <span className={clsx("text-[10px] transition-opacity", sortKey === "pct_to_bb_lower" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                      {sortIndicator(sortKey === "pct_to_bb_lower", sortDir)}
                    </span>
                  </button>
                </th>
              ) : null}
              {visibleColumns.signal ? <th scope="col" className="px-3 py-3 text-start text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.seqState")}</th> : null}
              {visibleColumns.matrix ? <th scope="col" className="px-3 py-3 text-start text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.columns.matrix")}</th> : null}
              {visibleColumns.whyMatched ? <th scope="col" className="px-3 py-3 text-start text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.columns.whyMatched")}</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row) => {
              const expanded = !!expandedTickers[row.ticker];
              return (
                <tr key={row.ticker} className="align-top hover:bg-surface-alt/50 transition-colors">
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
                  {visibleColumns.close ? (
                    <td className={clsx(densityRowClass, "text-end tabular-nums font-bold text-text")}>{fmt(row.close)}</td>
                  ) : null}
                  {visibleColumns.sma20 ? <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} /></td> : null}
                  {visibleColumns.sma50 ? <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} /></td> : null}
                  {visibleColumns.sma150 ? <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} /></td> : null}
                  {visibleColumns.sma200 ? <td className={clsx(densityRowClass, "text-center")}><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} /></td> : null}
                  {visibleColumns.atrPct ? <td className={clsx(densityRowClass, "text-end tabular-nums text-text-secondary")}>{fmt(row.atr_percent)}</td> : null}
                  {visibleColumns.bbUpper ? <td className={clsx(densityRowClass, "text-end tabular-nums text-text-secondary")}>{fmt(row.pct_to_bb_upper)}</td> : null}
                  {visibleColumns.bbLower ? <td className={clsx(densityRowClass, "text-end tabular-nums text-text-secondary")}>{fmt(row.pct_to_bb_lower)}</td> : null}
                  {visibleColumns.signal ? (
                    <td className={densityRowClass}>
                      <SignalBadge row={row} />
                    </td>
                  ) : null}
                  {visibleColumns.matrix ? (
                    <td className={clsx(densityRowClass, "min-w-[260px]")}>
                      <div className="grid grid-cols-3 gap-2">
                        <MatrixCell timeframe="1D" snapshot={row.timeframe_snapshots?.["1D"] ?? row} />
                        <MatrixCell timeframe="1W" snapshot={row.timeframe_snapshots?.["1W"] ?? null} />
                        <MatrixCell timeframe="1M" snapshot={row.timeframe_snapshots?.["1M"] ?? null} />
                      </div>
                    </td>
                  ) : null}
                  {visibleColumns.whyMatched ? (
                    <td className={clsx(densityRowClass, "min-w-[260px]")}>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(row.ticker)}
                        className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-secondary transition-colors hover:text-text"
                      >
                        {expanded ? t("workspace.hideWhyMatched") : t("workspace.showWhyMatched")}
                      </button>
                      {expanded ? (
                        <div className="mt-3 space-y-3 rounded-xl border border-border bg-surface-alt/80 p-3">
                          {(["1D", "1W", "1M"] as ScreenerTimeframe[]).map((timeframe) =>
                            groupedRules[timeframe].length > 0 ? (
                              <div key={`${row.ticker}-${timeframe}`}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                                  {t(`timeframes.${timeframe}`)}
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                                  {groupedRules[timeframe].map((rule) => (
                                    <li key={rule.id}>{describeRule(rule, t)}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null
                          )}
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
