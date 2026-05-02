"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import type { ScreenerPayload, ScreenerResultRow } from "@/lib/screener-types";
import { countActiveFilters, screenToQueryString } from "@/lib/screener-query";

type SortKey =
  | "ticker"
  | "close"
  | "atr_percent"
  | "pct_to_bb_upper"
  | "pct_to_bb_lower";
type SortDir = "asc" | "desc";

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
    return <span className="text-[11px] font-bold uppercase tracking-wide text-success">Up {row.up_sequence_count}</span>;
  }
  if (row.bearish_sequence_active) {
    return <span className="text-[11px] font-bold uppercase tracking-wide text-danger">Down {row.down_sequence_count}</span>;
  }
  return <span className="text-[11px] text-text-muted">—</span>;
}

function sortIndicator(active: boolean, dir: SortDir) {
  if (!active) return "";
  return dir === "asc" ? "▲" : "▼";
}

export function ResultsTable({ rows, loading, screenerFilters }: ResultsTableProps) {
  const t = useTranslations("screener");
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDir("asc");
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
    <section className="rounded-2xl border border-border-strong/70 bg-surface-raised shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
      <div className="border-b border-border bg-surface-alt/80 px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("results")}
            </p>
            <h2 className="mt-1 text-lg font-bold text-text">{t("symbols", { count: rows.length })}</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Live snapshot rows anchored on the daily view with multi-timeframe confirmation badges.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 xl:min-w-[360px]">
            <div className="rounded-xl border border-border bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Bullish</p>
              <p className="mt-1 text-lg font-bold text-success">{resultSummary.bullish}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Bearish</p>
              <p className="mt-1 text-lg font-bold text-danger">{resultSummary.bearish}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Strong</p>
              <p className="mt-1 text-lg font-bold text-primary">{resultSummary.strong}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {sorted.map((row) => (
          <article key={row.ticker} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
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
              {row.matched_timeframes?.map((timeframe) => (
                <span
                  key={`${row.ticker}-${timeframe}`}
                  className="inline-flex rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary"
                >
                  {timeframe}
                </span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border bg-surface-alt/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  {t("table.atrPct")}
                </p>
                <p className="mt-1 font-bold text-text">{fmt(row.atr_percent)}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-alt/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  {t("table.bbLower")}
                </p>
                <p className="mt-1 font-bold text-text">{fmt(row.pct_to_bb_lower)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="rounded-lg border border-border bg-surface-alt/70 p-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">20</p>
                <div className="mt-1"><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} /></div>
              </div>
              <div className="rounded-lg border border-border bg-surface-alt/70 p-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">50</p>
                <div className="mt-1"><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} /></div>
              </div>
              <div className="rounded-lg border border-border bg-surface-alt/70 p-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">150</p>
                <div className="mt-1"><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} /></div>
              </div>
              <div className="rounded-lg border border-border bg-surface-alt/70 p-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">200</p>
                <div className="mt-1"><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} /></div>
              </div>
            </div>
          </article>
        ))}
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
              <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                <button onClick={() => handleSort("close")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.close")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "close" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "close", sortDir)}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma20")}</th>
              <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma50")}</th>
              <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma150")}</th>
              <th scope="col" className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.sma200")}</th>
              <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                <button onClick={() => handleSort("atr_percent")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.atrPct")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "atr_percent" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "atr_percent", sortDir)}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                <button onClick={() => handleSort("pct_to_bb_upper")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.bbUpper")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "pct_to_bb_upper" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "pct_to_bb_upper", sortDir)}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-end text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                <button onClick={() => handleSort("pct_to_bb_lower")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.bbLower")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "pct_to_bb_lower" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "pct_to_bb_lower", sortDir)}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-start text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.seqState")}</th>
              <th scope="col" className="px-3 py-3 text-start text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("table.timeframes")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row) => (
              <tr key={row.ticker} className="hover:bg-surface-alt/50 transition-colors">
                <td className="px-4 py-3">
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
                <td className="px-3 py-3 text-end tabular-nums font-bold text-text">{fmt(row.close)}</td>
                <td className="px-2 py-3 text-center"><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} /></td>
                <td className="px-2 py-3 text-center"><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} /></td>
                <td className="px-2 py-3 text-center"><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} /></td>
                <td className="px-2 py-3 text-center"><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} /></td>
                <td className="px-3 py-3 text-end tabular-nums text-text-secondary">{fmt(row.atr_percent)}</td>
                <td className="px-3 py-3 text-end tabular-nums text-text-secondary">{fmt(row.pct_to_bb_upper)}</td>
                <td className="px-3 py-3 text-end tabular-nums text-text-secondary">{fmt(row.pct_to_bb_lower)}</td>
                <td className="px-3 py-3"><SignalBadge row={row} /></td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.matched_timeframes?.map((timeframe) => (
                      <span
                        key={`${row.ticker}-${timeframe}`}
                        className="inline-flex rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary"
                      >
                        {timeframe}
                      </span>
                    ))}
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
