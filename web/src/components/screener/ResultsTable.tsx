"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import type { SnapshotRow } from "@/lib/screener-types";

type SortKey = "ticker" | "close" | "atr_percent" | "pct_to_bb_upper" | "pct_to_bb_lower";
type SortDir = "asc" | "desc";

interface ResultsTableProps {
  rows: SnapshotRow[];
  loading?: boolean;
}

function fmt(val: number | null, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

function smaRelation(above: boolean | null, below: boolean | null): string {
  if (above) return "↑";
  if (below) return "↓";
  return "—";
}

function seqSummary(row: SnapshotRow): string {
  const parts: string[] = [];
  if (row.bullish_sequence_active) parts.push(`B${row.up_sequence_count}`);
  if (row.bearish_sequence_active) parts.push(`S${row.down_sequence_count}`);
  if (row.buy_signal) parts.push("BUY");
  if (row.sell_signal) parts.push("SELL");
  if (row.strong_buy_signal) parts.push("S-BUY");
  if (row.strong_sell_signal) parts.push("S-SELL");
  return parts.length > 0 ? parts.join(" ") : "—";
}

export function ResultsTable({ rows, loading }: ResultsTableProps) {
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
        className="inline-flex items-center gap-1 hover:text-text transition-colors"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <span className={clsx("text-xs", !active && "opacity-0")} aria-hidden="true">
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" role="status">
          <span className="sr-only">{t("results")}…</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-text-secondary">
        <p>{t("symbols", { count: 0 })}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-text-secondary">{t("symbols", { count: rows.length })}</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-start text-text-secondary">
              <th scope="col" className="px-3 py-2.5 text-start font-bold">
                <SortHeader label={t("table.ticker")} colKey="ticker" />
              </th>
              <th scope="col" className="px-3 py-2.5 text-end font-bold">
                <SortHeader label={t("table.close")} colKey="close" />
              </th>
              <th scope="col" className="px-3 py-2.5 text-center font-bold">{t("table.sma20")}</th>
              <th scope="col" className="px-3 py-2.5 text-center font-bold">{t("table.sma50")}</th>
              <th scope="col" className="px-3 py-2.5 text-center font-bold">{t("table.sma150")}</th>
              <th scope="col" className="px-3 py-2.5 text-center font-bold">{t("table.sma200")}</th>
              <th scope="col" className="px-3 py-2.5 text-end font-bold">
                <SortHeader label={t("table.atrPct")} colKey="atr_percent" />
              </th>
              <th scope="col" className="px-3 py-2.5 text-end font-bold">
                <SortHeader label={t("table.bbUpper")} colKey="pct_to_bb_upper" />
              </th>
              <th scope="col" className="px-3 py-2.5 text-end font-bold">
                <SortHeader label={t("table.bbLower")} colKey="pct_to_bb_lower" />
              </th>
              <th scope="col" className="px-3 py-2.5 text-start font-bold">{t("table.seqState")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.ticker}
                className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors"
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/ticker/${row.ticker}`}
                    className="font-bold text-primary hover:underline"
                  >
                    {row.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums">{fmt(row.close)}</td>
                <td className="px-3 py-2.5 text-center">{smaRelation(row.is_above_sma20, row.is_below_sma20)}</td>
                <td className="px-3 py-2.5 text-center">{smaRelation(row.is_above_sma50, row.is_below_sma50)}</td>
                <td className="px-3 py-2.5 text-center">{smaRelation(row.is_above_sma150, row.is_below_sma150)}</td>
                <td className="px-3 py-2.5 text-center">{smaRelation(row.is_above_sma200, row.is_below_sma200)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">{fmt(row.atr_percent)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">{fmt(row.pct_to_bb_upper)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">{fmt(row.pct_to_bb_lower)}</td>
                <td className="px-3 py-2.5 text-start text-xs">
                  <span className={clsx(
                    row.buy_signal || row.strong_buy_signal ? "text-success font-bold" :
                    row.sell_signal || row.strong_sell_signal ? "text-danger font-bold" :
                    "text-text-secondary"
                  )}>
                    {seqSummary(row)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
