"use client";

import { clsx } from "clsx";
import { useLocale } from "next-intl";
import { TradingViewAdvancedChart } from "@/components/chart/TradingViewAdvancedChart";
import { Link } from "@/i18n/navigation";
import { tradingViewSymbol } from "@/lib/screener-query";
import type { LookupCoveragePayload, TrendTone } from "./types";

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
  formatCurrency,
  formatPercent,
  formatMarketCap,
  t,
}: StockLookupHeaderProps) {
  const locale = useLocale();
  const meta = coverage.metadata;
  const tvSymbol = tradingViewSymbol(coverage.ticker, meta?.listing_exchange);
  const summaryCards = [
    { label: t("workspace.marketCap"), value: formatMarketCap(meta?.market_cap) },
    { label: t("workspace.atrPct"), value: formatPercent(coverage.dailySnapshot.atr_percent) },
    { label: t("workspace.industry"), value: meta?.industry || "—" },
    { label: t("workspace.exchange"), value: meta?.listing_exchange || coverage.market },
  ];

  return (
    <section className="ui-panel overflow-hidden rounded-[26px]">
      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col border-b border-divider-soft px-5 py-6 xl:border-b-0 xl:border-e xl:px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon">{t("workspace.overview")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold tracking-[-0.04em] text-text">{coverage.ticker}</h1>
            <span className={clsx("rounded-full px-3 py-1 text-xs font-bold ring-1", toneClass(overallTone))}>
              {t(`status.${overallTone}`)}
            </span>
          </div>
          <p className="mt-2 text-base font-semibold text-text-secondary">
            {meta?.company_name || t("workspace.noCompanyName")}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {[meta?.sector, coverage.market, coverage.snapshot.last_trade_date].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">{t("workspace.lastPrice")}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-[-0.03em] text-text">
                {formatCurrency(coverage.snapshot.close)}
              </p>
            </div>
            <p className={clsx(
              "pb-1 text-base font-bold tabular-nums",
              dailyChangePct == null ? "text-text-muted" : dailyChangePct >= 0 ? "text-success" : "text-danger"
            )}>
              {dailyChangePct == null ? "—" : formatPercent(dailyChangePct)}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl bg-surface-alt/70 px-3 py-3 ring-1 ring-border/80">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{card.label}</p>
                <p className="mt-1 truncate text-sm font-semibold text-text">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.signalSummary")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {headerBadges.length ? headerBadges.slice(0, 4).map((badge) => (
                <span key={badge.id} className={clsx("rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", toneClass(badge.tone))}>
                  {badge.label}
                </span>
              )) : <span className="text-sm text-text-secondary">{t("insights.waitingForConfirmation")}</span>}
            </div>
          </div>

          <div className="mt-auto pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.timeframeMatrix")}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {timeframeStates.map((item) => (
                <div key={item.timeframe} className="rounded-xl bg-surface-alt/70 px-2 py-2 text-center ring-1 ring-border/80">
                  <p className="text-xs font-bold text-text">{item.timeframe}</p>
                  <p className={clsx("mt-0.5 text-[10px] font-semibold", item.tone === "bullish" ? "text-success" : item.tone === "bearish" ? "text-danger" : "text-text-muted")}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-bold text-text">{t("workspace.tradingViewChart")}</p>
              <p className="text-xs text-text-muted">{t("workspace.chartSubtitle")}</p>
            </div>
            <Link href={`/ticker/${coverage.ticker}`} className="link-hover text-xs font-bold text-primary">
              {t("workspace.openFullChart")}
            </Link>
          </div>
          <TradingViewAdvancedChart symbol={tvSymbol} height={390} locale={locale} compact />
        </div>
      </div>
    </section>
  );
}
