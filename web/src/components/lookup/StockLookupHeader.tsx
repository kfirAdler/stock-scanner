"use client";

import { clsx } from "clsx";
import type { LookupCondition, LookupCoveragePayload, TrendTone } from "./types";

type HeaderBadge = {
  id: string;
  label: string;
  tone: TrendTone | "accent";
};

type StockLookupHeaderProps = {
  coverage: LookupCoveragePayload;
  sparklinePoints: string;
  dailyChangePct: number | null;
  overallTone: TrendTone;
  headerBadges: HeaderBadge[];
  timeframeStates: { timeframe: "1D" | "1W" | "1M"; tone: TrendTone; label: string }[];
  coreConditions: LookupCondition[];
  formatCurrency: (value: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
  formatMarketCap: (value: number | null | undefined) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function toneClass(tone: TrendTone | "accent") {
  if (tone === "bullish") return "bg-success-soft text-success ring-success/15";
  if (tone === "bearish") return "bg-danger-soft text-danger ring-danger/15";
  if (tone === "accent") return "bg-primary-soft text-primary ring-primary/10";
  return "bg-surface text-text-secondary ring-border";
}

export function StockLookupHeader({
  coverage,
  sparklinePoints,
  dailyChangePct,
  overallTone,
  headerBadges,
  timeframeStates,
  coreConditions,
  formatCurrency,
  formatPercent,
  formatMarketCap,
  t,
}: StockLookupHeaderProps) {
  const meta = coverage.metadata;
  return (
    <section className="overflow-hidden rounded-[24px] bg-surface-raised shadow-[0_12px_34px_rgba(15,23,42,0.06)] ring-1 ring-border dark:ring-[#183241]">
      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.5fr)_280px] lg:px-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-bold tracking-[-0.02em] text-text">{coverage.ticker}</h1>
                <span className={clsx("rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", toneClass(overallTone))}>
                  {t(`status.${overallTone}`)}
                </span>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {meta?.company_name || t("workspace.noCompanyName")} {meta?.sector ? `· ${meta.sector}` : ""}
              </p>
              <p className="mt-1 text-[12px] text-text-muted">
                {coverage.market} · {coverage.barCount} {t("workspace.dailyBars")} · {coverage.snapshot.last_trade_date}
              </p>
            </div>

            <div className="text-end">
              <p className="text-[30px] font-bold tabular-nums tracking-[-0.02em] text-text">
                {formatCurrency(coverage.snapshot.close)}
              </p>
              <p
                className={clsx(
                  "mt-1 text-sm font-semibold tabular-nums",
                  dailyChangePct == null
                    ? "text-text-muted"
                    : dailyChangePct >= 0
                      ? "text-success"
                      : "text-danger"
                )}
              >
                {dailyChangePct == null ? "—" : formatPercent(dailyChangePct / 100)}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-surface-alt/75 px-3 py-3 ring-1 ring-border">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.marketCap")}</p>
              <p className="mt-1 text-sm font-semibold text-text">{formatMarketCap(meta?.market_cap)}</p>
            </div>
            <div className="rounded-2xl bg-surface-alt/75 px-3 py-3 ring-1 ring-border">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.atrPct")}</p>
              <p className="mt-1 text-sm font-semibold text-text">
                {formatPercent(coverage.dailySnapshot.atr_percent)}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-alt/75 px-3 py-3 ring-1 ring-border">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.sequence")}</p>
              <p className="mt-1 text-sm font-semibold text-text">{t(`sequence.${overallTone}`)}</p>
            </div>
            <div className="rounded-2xl bg-surface-alt/75 px-3 py-3 ring-1 ring-border">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.industry")}</p>
              <p className="mt-1 truncate text-sm font-semibold text-text">{meta?.industry || "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {headerBadges.map((badge) => (
              <span key={badge.id} className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", toneClass(badge.tone))}>
                {badge.label}
              </span>
            ))}
          </div>

          <div className="rounded-2xl bg-surface-alt/70 px-3 py-3 ring-1 ring-border">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.currentMatches")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {coreConditions.slice(0, 8).map((condition) => (
                <span key={condition.id} className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary ring-1 ring-border">
                  {condition.timeframe} · {condition.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] bg-[radial-gradient(circle_at_top,rgba(56,88,215,0.12),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,249,252,0.98))] px-4 py-4 ring-1 ring-border dark:bg-[radial-gradient(circle_at_top,rgba(56,88,215,0.16),transparent_55%),linear-gradient(180deg,rgba(7,14,22,0.98),rgba(6,12,18,0.98))]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.priceStructure")}</p>
              <span className="text-[11px] text-text-muted">{t("workspace.last60Bars")}</span>
            </div>
            <svg viewBox="0 0 100 36" className="mt-3 h-24 w-full overflow-visible">
              <defs>
                <linearGradient id="lookupSparkline" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.95" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="url(#lookupSparkline)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={overallTone === "bearish" ? "text-danger" : "text-primary"}
                points={sparklinePoints}
              />
            </svg>
          </div>

          <div className="rounded-2xl bg-surface-alt/75 px-4 py-4 ring-1 ring-border">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.timeframeMatrix")}</p>
            <div className="mt-3 space-y-2">
              {timeframeStates.map((item) => (
                <div key={item.timeframe} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 ring-1 ring-border">
                  <span className="text-sm font-semibold text-text">{item.timeframe}</span>
                  <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", toneClass(item.tone))}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
