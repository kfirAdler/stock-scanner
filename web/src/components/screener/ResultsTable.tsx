"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import type { ScreenerFilters, SnapshotRow } from "@/lib/screener-types";
import {
  countActiveFilters,
  filtersToQueryString,
} from "@/lib/screener-query";

type SortKey = "ticker" | "close" | "atr_percent" | "pct_to_bb_upper" | "pct_to_bb_lower";
type SortDir = "asc" | "desc";

interface ResultsTableProps {
  rows: SnapshotRow[];
  loading?: boolean;
  screenerFilters?: ScreenerFilters;
}

function fmt(val: number | null, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

function SmaPill({ above, below }: { above: boolean | null; below: boolean | null }) {
  if (above) return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-success-soft text-success">↑</span>;
  if (below) return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-soft text-danger">↓</span>;
  return <span className="text-text-muted">—</span>;
}

function SignalBadge({ row }: { row: SnapshotRow }) {
  if (row.strong_buy_signal) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-soft text-success">▲▲ STRONG BUY</span>;
  if (row.buy_signal) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-soft text-success">▲ BUY</span>;
  if (row.strong_sell_signal) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger-soft text-danger">▼▼ STRONG SELL</span>;
  if (row.sell_signal) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger-soft text-danger">▼ SELL</span>;
  if (row.bullish_sequence_active) return <span className="text-[10px] text-success font-bold">Bull {row.up_sequence_count}</span>;
  if (row.bearish_sequence_active) return <span className="text-[10px] text-danger font-bold">Bear {row.down_sequence_count}</span>;
  return <span className="text-text-muted text-[10px]">—</span>;
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
      ? filtersToQueryString(screenerFilters)
      : "";

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function SortHeader({ label, colKey }: { label: string; colKey: SortKey }) {
    const active = sortKey === colKey;
    return (
      <button
        onClick={() => handleSort(colKey)}
        className="inline-flex items-center gap-1 hover:text-text transition-colors group"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <span className={clsx("text-[10px] transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-40")} aria-hidden="true">
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    );
  }

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
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </div>
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
                <SortHeader label={t("table.ticker")} colKey="ticker" />
              </th>
              <th scope="col" className="px-3 py-3 text-end text-xs font-bold text-text-muted">
                <SortHeader label={t("table.close")} colKey="close" />
              </th>
              <th scope="col" className="px-2 py-3 text-center text-xs font-bold text-text-muted">{t("table.sma20")}</th>
              <th scope="col" className="px-2 py-3 text-center text-xs font-bold text-text-muted">{t("table.sma50")}</th>
              <th scope="col" className="px-2 py-3 text-center text-xs font-bold text-text-muted">{t("table.sma150")}</th>
              <th scope="col" className="px-2 py-3 text-center text-xs font-bold text-text-muted">{t("table.sma200")}</th>
              <th scope="col" className="px-3 py-3 text-end text-xs font-bold text-text-muted">
                <SortHeader label={t("table.atrPct")} colKey="atr_percent" />
              </th>
              <th scope="col" className="px-3 py-3 text-end text-xs font-bold text-text-muted">
                <SortHeader label={t("table.bbUpper")} colKey="pct_to_bb_upper" />
              </th>
              <th scope="col" className="px-3 py-3 text-end text-xs font-bold text-text-muted">
                <SortHeader label={t("table.bbLower")} colKey="pct_to_bb_lower" />
              </th>
              <th scope="col" className="px-3 py-3 text-start text-xs font-bold text-text-muted">{t("table.seqState")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row) => (
              <tr
                key={row.ticker}
                className="hover:bg-surface-alt/50 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/ticker/${row.ticker}${tickerQuery}`}
                    className="font-bold text-primary hover:underline decoration-primary/30 underline-offset-2"
                  >
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
