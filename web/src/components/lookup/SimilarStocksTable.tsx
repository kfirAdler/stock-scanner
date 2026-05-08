"use client";

import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import type { SimilarSetupRow, SimilarVariant } from "./types";
import { SimilarityBadge } from "./SimilarityBadge";

type SimilarStocksTableProps = {
  rows: SimilarSetupRow[];
  activeVariant: SimilarVariant;
  onChangeVariant: (variant: SimilarVariant) => void;
  loading: boolean;
  variantLabels: Record<SimilarVariant, string>;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export function SimilarStocksTable({
  rows,
  activeVariant,
  onChangeVariant,
  loading,
  variantLabels,
  t,
}: SimilarStocksTableProps) {
  return (
    <section className="rounded-[22px] bg-surface-raised px-4 py-4 ring-1 ring-border shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:ring-[#183241]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.similarSetups")}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t("workspace.similarSetupsSub")}</p>
        </div>
        <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-surface-alt p-1 ring-1 ring-border">
          {(Object.keys(variantLabels) as SimilarVariant[]).map((variant) => (
            <button
              key={variant}
              type="button"
              onClick={() => onChangeVariant(variant)}
              className={clsx(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                activeVariant === variant
                  ? "bg-surface-raised text-text shadow-sm ring-1 ring-border"
                  : "text-text-muted hover:text-text"
              )}
            >
              {variantLabels[variant]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[18px] bg-surface-alt/55 ring-1 ring-border">
        <div className="hidden grid-cols-[120px_110px_110px_100px_150px_minmax(0,1fr)] gap-0 border-b border-border/80 bg-surface-alt/85 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted lg:grid">
          <div>{t("workspace.ticker")}</div>
          <div>{t("workspace.similarity")}</div>
          <div>{t("workspace.sequence")}</div>
          <div>{t("workspace.atrPct")}</div>
          <div>{t("workspace.timeframeMatrix")}</div>
          <div>{t("workspace.notes")}</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-text-muted">{t("loadingSimilar")}</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-text-muted">{t("workspace.noSimilar")}</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map(({ row, score, note }) => {
              const daily = row.timeframe_snapshots?.["1D"] ?? row;
              const weekly = row.timeframe_snapshots?.["1W"] ?? null;
              const monthly = row.timeframe_snapshots?.["1M"] ?? null;
              const matrix = [
                daily?.bullish_sequence_active ? "D+" : daily?.bearish_sequence_active ? "D-" : "D·",
                weekly?.bullish_sequence_active ? "W+" : weekly?.bearish_sequence_active ? "W-" : "W·",
                monthly?.bullish_sequence_active ? "M+" : monthly?.bearish_sequence_active ? "M-" : "M·",
              ].join(" ");
              return (
                <div key={row.ticker} className="grid gap-2 px-4 py-3 text-sm lg:grid-cols-[120px_110px_110px_100px_150px_minmax(0,1fr)] lg:items-center">
                  <Link href={`/ticker/${row.ticker}`} className="font-bold text-text hover:text-primary">
                    {row.ticker}
                  </Link>
                  <div><SimilarityBadge score={score} /></div>
                  <div className="text-text-secondary">
                    {daily.bullish_sequence_active
                      ? t("sequence.bullish")
                      : daily.bearish_sequence_active
                        ? t("sequence.bearish")
                        : t("status.neutral")}
                  </div>
                  <div className="tabular-nums text-text-secondary">
                    {daily.atr_percent == null ? "—" : `${daily.atr_percent.toFixed(2)}%`}
                  </div>
                  <div className="text-[12px] font-semibold text-text-secondary">{matrix}</div>
                  <div className="text-[12px] text-text-secondary">{note}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
