"use client";

import { clsx } from "clsx";
import { useLocale } from "next-intl";
import { TradingViewAdvancedChart } from "@/components/chart/TradingViewAdvancedChart";
import { tradingViewSymbol } from "@/lib/screener-query";
import type { LookupCondition, LookupCoveragePayload, TrendTone } from "./types";

type HeaderBadge = {
  id: string;
  label: string;
  tone: TrendTone | "accent";
};

type StockLookupHeaderProps = {
  coverage: LookupCoveragePayload;
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
  return "bg-surface-elevated text-text-secondary ring-border";
}

export function StockLookupHeader({
  coverage,
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
  const locale = useLocale();
  const meta = coverage.metadata;
  const tvSymbol = tradingViewSymbol(coverage.ticker, meta?.listing_exchange);
  const summaryCards = [
    meta?.market_cap != null
      ? {
          key: "market-cap",
          label: t("workspace.marketCap"),
          value: formatMarketCap(meta.market_cap),
        }
      : null,
    coverage.dailySnapshot.atr_percent != null
      ? {
          key: "atr",
          label: t("workspace.atrPct"),
          value: formatPercent(coverage.dailySnapshot.atr_percent),
        }
      : null,
    {
      key: "sequence",
      label: t("workspace.sequence"),
      value: t(`sequence.${overallTone}`),
    },
    meta?.industry
      ? {
          key: "industry",
          label: t("workspace.industry"),
          value: meta.industry,
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[];

  return (
    <section className="ui-panel overflow-hidden rounded-[24px]">
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
              {meta?.company_name || meta?.sector ? (
                <p className="mt-1 text-sm text-text-secondary">
                  {[meta?.company_name, meta?.sector].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <p className="mt-1 text-[12px] text-text-muted">
                {coverage.market} · {coverage.snapshot.last_trade_date}
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
                {dailyChangePct == null ? "—" : formatPercent(dailyChangePct)}
              </p>
            </div>
          </div>

          <div className={clsx("grid gap-2", summaryCards.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3")}>
            {summaryCards.map((card) => (
              <div key={card.key} className="ui-panel-subtle rounded-2xl px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{card.label}</p>
                <p className="mt-1 truncate text-sm font-semibold text-text">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {headerBadges.slice(0, 5).map((badge) => (
              <span key={badge.id} className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", toneClass(badge.tone))}>
                {badge.label}
              </span>
            ))}
          </div>

          {coreConditions.length > 0 ? (
            <div className="ui-panel-subtle rounded-2xl px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.currentMatches")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {coreConditions.slice(0, 6).map((condition) => (
                  <span key={condition.id} className="rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-text-secondary ring-1 ring-border">
                    {(condition.timeframeLabel ?? condition.timeframe)} · {condition.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="ui-panel-subtle overflow-hidden rounded-[22px] p-2">
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.tradingViewChart")}</p>
              <span className="text-[11px] text-text-muted">{t("workspace.dailyChart")}</span>
            </div>
            <TradingViewAdvancedChart
              symbol={tvSymbol}
              height={174}
              locale={locale}
              compact
            />
          </div>

          <div className="ui-panel-subtle rounded-2xl px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.timeframeMatrix")}</p>
            <div className="mt-3 space-y-2">
              {timeframeStates.map((item) => (
                <div key={item.timeframe} className="flex items-center justify-between rounded-xl bg-surface-elevated px-3 py-2 ring-1 ring-border">
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
