"use client";

import { clsx } from "clsx";
import type { ScreenerTimeframe, SnapshotRow } from "@/lib/screener-types";
import type { TrendTone } from "./types";

type TechnicalSummaryPanelProps = {
  snapshots: Partial<Record<ScreenerTimeframe, SnapshotRow | null>>;
  classifyTrend: (snapshot: SnapshotRow | null | undefined) => TrendTone;
  formatPercent: (value: number | null | undefined) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function toneClasses(tone: TrendTone) {
  if (tone === "bullish") return "bg-success-soft text-success ring-success/15";
  if (tone === "bearish") return "bg-danger-soft text-danger ring-danger/15";
  return "bg-surface text-text-secondary ring-border";
}

function summaryLines(snapshot: SnapshotRow | null | undefined, t: TechnicalSummaryPanelProps["t"]) {
  if (!snapshot) return [t("workspace.noSnapshot")];
  const lines: string[] = [];
  if (snapshot.is_above_sma20) lines.push(t("badges.aboveSma20"));
  if (snapshot.is_above_sma150) lines.push(t("badges.aboveSma150"));
  if (snapshot.strong_buy_signal) lines.push(t("badges.strongBullish"));
  else if (snapshot.buy_signal) lines.push(t("badges.bullishBreak"));
  if (snapshot.bullish_sequence_active) lines.push(t("badges.upSequence"));
  if (snapshot.bearish_sequence_active) lines.push(t("badges.downSequence"));
  return lines.slice(0, 3);
}

export function TechnicalSummaryPanel({
  snapshots,
  classifyTrend,
  formatPercent,
  t,
}: TechnicalSummaryPanelProps) {
  return (
    <section className="ui-panel rounded-[22px] px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.technicalSummary")}</h2>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {(["1D", "1W", "1M"] as ScreenerTimeframe[]).map((timeframe) => {
          const snapshot = snapshots[timeframe];
          const tone = classifyTrend(snapshot);
          return (
            <div key={timeframe} className="ui-panel-subtle rounded-2xl px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-text">{t(`timeframes.${timeframe}`)}</span>
                <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", toneClasses(tone))}>
                  {t(`status.${tone}`)}
                </span>
              </div>
              <p className="mt-2 text-[12px] text-text-muted">
                {snapshot?.last_trade_date || t("workspace.noSnapshot")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {summaryLines(snapshot, t).map((line) => (
                  <span key={line} className="rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] text-text-secondary ring-1 ring-border">
                    {line}
                  </span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-xl bg-surface-elevated px-2.5 py-2 ring-1 ring-border">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.atrPct")}</p>
                  <p className="mt-1 font-semibold text-text">{formatPercent(snapshot?.atr_percent)}</p>
                </div>
                <div className="rounded-xl bg-surface-elevated px-2.5 py-2 ring-1 ring-border">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.sequenceCount")}</p>
                  <p className="mt-1 font-semibold text-text">
                    {snapshot?.up_sequence_count || 0}/{snapshot?.down_sequence_count || 0}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
