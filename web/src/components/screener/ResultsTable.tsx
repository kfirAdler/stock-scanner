"use client";

import { useState } from "react";
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
  if (above) return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-success-soft text-success">↑</span>;
  if (below) return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-soft text-danger">↓</span>;
  return <span className="text-text-muted">—</span>;
}

function SignalBadge({ row }: { row: ScreenerResultRow }) {
  if (row.strong_buy_signal) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-soft text-success">▲▲ STRONG BULLISH BREAK</span>;
  if (row.buy_signal) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-soft text-success">▲ BULLISH BREAK</span>;
  if (row.strong_sell_signal) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger-soft text-danger">▼▼ STRONG BEARISH BREAK</span>;
  if (row.sell_signal) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger-soft text-danger">▼ BEARISH BREAK</span>;
  if (row.bullish_sequence_active) return <span className="text-[10px] text-success font-bold">Up {row.up_sequence_count}</span>;
  if (row.bearish_sequence_active) return <span className="text-[10px] text-danger font-bold">Down {row.down_sequence_count}</span>;
  return <span className="text-text-muted text-[10px]">—</span>;
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
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const tickerQuery =
    screenerFilters && countActiveFilters(screenerFilters) > 0
      ? screenToQueryString(screenerFilters)
      : "";

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-[3px] border-primary/30 border-t-primary rounded-full" role="status" />
          <span className="text-sm text-text-muted">{t("results")}…</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-20 text-text-muted">
        <p className="font-bold">{t("symbols", { count: 0 })}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-bold text-text-muted uppercase tracking-wider">
        {t("symbols", { count: rows.length })}
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-start">
              <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-text-muted">
                <button onClick={() => handleSort("ticker")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.ticker")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "ticker" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "ticker", sortDir)}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-end text-xs font-bold text-text-muted">
                <button onClick={() => handleSort("close")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.close")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "close" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "close", sortDir)}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-2 py-3 text-center text-xs font-bold text-text-muted">{t("table.sma20")}</th>
              <th scope="col" className="px-2 py-3 text-center text-xs font-bold text-text-muted">{t("table.sma50")}</th>
              <th scope="col" className="px-2 py-3 text-center text-xs font-bold text-text-muted">{t("table.sma150")}</th>
              <th scope="col" className="px-2 py-3 text-center text-xs font-bold text-text-muted">{t("table.sma200")}</th>
              <th scope="col" className="px-3 py-3 text-end text-xs font-bold text-text-muted">
                <button onClick={() => handleSort("atr_percent")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.atrPct")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "atr_percent" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "atr_percent", sortDir)}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-end text-xs font-bold text-text-muted">
                <button onClick={() => handleSort("pct_to_bb_upper")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.bbUpper")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "pct_to_bb_upper" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "pct_to_bb_upper", sortDir)}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-end text-xs font-bold text-text-muted">
                <button onClick={() => handleSort("pct_to_bb_lower")} className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {t("table.bbLower")}
                  <span className={clsx("text-[10px] transition-opacity", sortKey === "pct_to_bb_lower" ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
                    {sortIndicator(sortKey === "pct_to_bb_lower", sortDir)}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-start text-xs font-bold text-text-muted">{t("table.seqState")}</th>
              <th scope="col" className="px-3 py-3 text-start text-xs font-bold text-text-muted">{t("table.timeframes")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row) => (
              <tr key={row.ticker} className="hover:bg-surface-alt/50 transition-colors">
                <td className="px-4 py-2.5">
                  <Link href={`/ticker/${row.ticker}${tickerQuery}`} className="font-bold text-primary hover:underline decoration-primary/30 underline-offset-2">
                    {row.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums font-bold">{fmt(row.close)}</td>
                <td className="px-2 py-2.5 text-center"><SmaPill above={row.is_above_sma20} below={row.is_below_sma20} /></td>
                <td className="px-2 py-2.5 text-center"><SmaPill above={row.is_above_sma50} below={row.is_below_sma50} /></td>
                <td className="px-2 py-2.5 text-center"><SmaPill above={row.is_above_sma150} below={row.is_below_sma150} /></td>
                <td className="px-2 py-2.5 text-center"><SmaPill above={row.is_above_sma200} below={row.is_below_sma200} /></td>
                <td className="px-3 py-2.5 text-end tabular-nums text-text-secondary">{fmt(row.atr_percent)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums text-text-secondary">{fmt(row.pct_to_bb_upper)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums text-text-secondary">{fmt(row.pct_to_bb_lower)}</td>
                <td className="px-3 py-2.5"><SignalBadge row={row} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {row.matched_timeframes?.map((timeframe) => (
                      <span key={`${row.ticker}-${timeframe}`} className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
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
    </div>
  );
}
