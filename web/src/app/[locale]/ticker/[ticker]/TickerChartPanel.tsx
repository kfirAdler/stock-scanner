"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { clsx } from "clsx";
import { CandlestickChart } from "@/components/chart/CandlestickChart";
import { TradingViewAdvancedChart } from "@/components/chart/TradingViewAdvancedChart";
import {
  countActiveFilters,
  filtersToTvStudies,
  hasSequenceFilters,
  parseFiltersFromSearchParams,
  smaPeriodsFromFilters,
  tradingViewSymbol,
} from "@/lib/screener-query";

interface BarRow {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type TabId = "tradingview" | "app";

export function TickerChartPanel({
  ticker,
  bars,
}: {
  ticker: string;
  bars: BarRow[];
}) {
  const t = useTranslations("ticker");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>("tradingview");

  const filters = useMemo(
    () => parseFiltersFromSearchParams(searchParams),
    [searchParams]
  );
  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters]
  );
  const tvStudies = useMemo(() => filtersToTvStudies(filters), [filters]);
  const appSmaPeriods = useMemo(() => smaPeriodsFromFilters(filters), [filters]);
  const showScreenerHint = activeFilterCount > 0;
  const showSequenceNote = hasSequenceFilters(filters);

  const tvSymbol = tradingViewSymbol(ticker);

  return (
    <section className="space-y-3" aria-label={t("chart.sectionLabel")}>
      {showScreenerHint && (
        <div
          className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-text-secondary"
          role="status"
        >
          <p className="font-bold text-text">{t("chart.screenerContextTitle")}</p>
          {tvStudies.length > 0 && (
            <p className="mt-1 text-xs leading-relaxed">
              {t("chart.screenerStudiesHint", { count: tvStudies.length })}
            </p>
          )}
          {showSequenceNote && (
            <p className="mt-1 text-xs leading-relaxed">{t("chart.sequenceFiltersHint")}</p>
          )}
          {tvStudies.length === 0 && !showSequenceNote && (
            <p className="mt-1 text-xs leading-relaxed">{t("chart.screenerGenericHint")}</p>
          )}
        </div>
      )}

      <div
        role="tablist"
        className="flex gap-1 rounded-xl border border-border bg-surface-alt p-1 w-fit"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "tradingview"}
          onClick={() => setTab("tradingview")}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
            tab === "tradingview"
              ? "bg-surface-raised text-text shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          {t("chart.tabTradingView")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "app"}
          onClick={() => setTab("app")}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
            tab === "app"
              ? "bg-surface-raised text-text shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          {t("chart.tabAppData")}
        </button>
      </div>

      {tab === "tradingview" && (
        <div role="tabpanel" className="space-y-2">
          <TradingViewAdvancedChart
            symbol={tvSymbol}
            height={560}
            studies={tvStudies}
            locale={locale}
          />
          <p className="mt-2 text-center text-[10px] text-text-muted">
            <a
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border hover:text-primary"
            >
              {t("chart.tradingViewAttribution")}
            </a>
          </p>
        </div>
      )}

      {tab === "app" && (
        <div role="tabpanel" className="space-y-2">
          <CandlestickChart
            bars={bars}
            height={420}
            smaPeriods={appSmaPeriods}
          />
          <p className="mt-1 text-[10px] text-text-muted">{t("chart.appDataCaption")}</p>
        </div>
      )}
    </section>
  );
}
