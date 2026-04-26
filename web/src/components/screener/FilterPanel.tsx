"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { ScreenerFilters } from "@/lib/screener-types";

type TabId = "ma" | "signals" | "seq" | "bb" | "vol" | "price";

interface FilterPanelProps {
  filters: ScreenerFilters;
  onChange: (filters: ScreenerFilters) => void;
  onApply: () => void;
  loading?: boolean;
  onSaveScan: () => void;
  saveScanLoading?: boolean;
  onSaveFavorite: () => void;
  onLoadFavorite: () => void;
  favoriteSaving?: boolean;
  favoriteLoading?: boolean;
  favoriteAvailable?: boolean;
  favoriteStatus?: string | null;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M10 2.25 12.4 7.1l5.35.78-3.87 3.77.91 5.32L10 14.45l-4.79 2.52.91-5.32L2.25 7.88l5.35-.78L10 2.25Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FilterPanel({
  filters,
  onChange,
  onApply,
  loading,
  onSaveScan,
  saveScanLoading,
  onSaveFavorite,
  onLoadFavorite,
  favoriteSaving,
  favoriteLoading,
  favoriteAvailable,
  favoriteStatus,
}: FilterPanelProps) {
  const t = useTranslations("screener");
  const [activeTab, setActiveTab] = useState<TabId>("ma");

  const tabs: { id: TabId; label: string }[] = [
    { id: "ma", label: t("tabs.movingAverages") },
    { id: "signals", label: t("tabs.signals") },
    { id: "seq", label: t("tabs.sequences") },
    { id: "bb", label: t("tabs.bands") },
    { id: "vol", label: t("tabs.volatility") },
    { id: "price", label: t("tabs.priceFundamentals") },
  ];

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== null && v !== ""
  ).length;

  function toggleBool(key: keyof ScreenerFilters) {
    const current = filters[key];
    onChange({ ...filters, [key]: current ? undefined : true });
  }

  function setNum(key: keyof ScreenerFilters, val: string) {
    const num = val === "" ? undefined : parseFloat(val);
    onChange({ ...filters, [key]: num });
  }

  function clearAll() {
    onChange({});
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-raised shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-surface-alt border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-text">{t("filters")}</h2>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onSaveScan}
            loading={saveScanLoading}
            disabled={activeFilterCount === 0}
          >
            <span>{t("saveScan")}</span>
          </Button>
          <Button
            type="button"
            variant={favoriteAvailable ? "secondary" : "ghost"}
            size="sm"
            onClick={onSaveFavorite}
            loading={favoriteSaving}
            disabled={activeFilterCount === 0}
            className={clsx(
              "min-w-0",
              favoriteAvailable && "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300"
            )}
            aria-label={favoriteAvailable ? t("favorite.update") : t("favorite.save")}
            title={favoriteAvailable ? t("favorite.update") : t("favorite.save")}
          >
            <StarIcon filled={!!favoriteAvailable} />
            <span className="hidden sm:inline">
              {favoriteAvailable ? t("favorite.update") : t("favorite.save")}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onLoadFavorite}
            loading={favoriteLoading}
            disabled={!favoriteAvailable}
            aria-label={t("favorite.load")}
            title={t("favorite.load")}
          >
            <span>{t("favorite.load")}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={activeFilterCount === 0}>
            {t("clearFilters")}
          </Button>
          <Button size="sm" onClick={() => onApply()} loading={loading}>
            {t("applyFilters")}
          </Button>
        </div>
      </div>

      {favoriteStatus && (
        <div
          className="border-b border-border bg-surface px-5 py-2 text-xs font-medium text-text-secondary"
          aria-live="polite"
        >
          {favoriteStatus}
        </div>
      )}

      <div role="tablist" className="flex overflow-x-auto bg-surface">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "relative shrink-0 px-4 py-3 text-xs font-bold transition-colors",
              activeTab === tab.id
                ? "text-primary"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="px-5 py-3.5 bg-surface-alt/60 border-b border-border">
        <label htmlFor="screener-listing-market" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
          {t("listingMarket.label")}
        </label>
        <select
          id="screener-listing-market"
          className="w-full max-w-md rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={filters.listing_market ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              listing_market: v === "" ? undefined : (v as "US" | "TA"),
            });
          }}
        >
          <option value="">{t("listingMarket.all")}</option>
          <option value="US">{t("listingMarket.us")}</option>
          <option value="TA">{t("listingMarket.ta")}</option>
        </select>
      </div>

      <div className="p-5 border-t border-border">
        {activeTab === "ma" && (
          <div
            role="tabpanel"
            id="panel-ma"
            aria-labelledby="tab-ma"
            className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3"
          >
            {([20, 50, 150, 200] as const).map((period) => (
              <div key={period} className="space-y-2.5">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  SMA {period}
                </p>
                <Checkbox
                  label={t("ma.aboveSMA", { period })}
                  checked={!!filters[`is_above_sma${period}` as keyof ScreenerFilters]}
                  onChange={() => toggleBool(`is_above_sma${period}` as keyof ScreenerFilters)}
                />
                <Checkbox
                  label={t("ma.belowSMA", { period })}
                  checked={!!filters[`is_below_sma${period}` as keyof ScreenerFilters]}
                  onChange={() => toggleBool(`is_below_sma${period}` as keyof ScreenerFilters)}
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === "signals" && (
          <div
            role="tabpanel"
            id="panel-signals"
            aria-labelledby="tab-signals"
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5"
          >
            <Checkbox label={t("signals.buy")} checked={!!filters.buy_signal} onChange={() => toggleBool("buy_signal")} />
            <Checkbox label={t("signals.sell")} checked={!!filters.sell_signal} onChange={() => toggleBool("sell_signal")} />
            <Checkbox label={t("signals.strongBuy")} checked={!!filters.strong_buy_signal} onChange={() => toggleBool("strong_buy_signal")} />
            <Checkbox label={t("signals.strongSell")} checked={!!filters.strong_sell_signal} onChange={() => toggleBool("strong_sell_signal")} />
            <Checkbox label={t("signals.bullishSeq")} checked={!!filters.bullish_sequence_active} onChange={() => toggleBool("bullish_sequence_active")} />
            <Checkbox label={t("signals.bearishSeq")} checked={!!filters.bearish_sequence_active} onChange={() => toggleBool("bearish_sequence_active")} />
            <Checkbox label={t("signals.strongUpCtx")} checked={!!filters.strong_up_sequence_context} onChange={() => toggleBool("strong_up_sequence_context")} />
            <Checkbox label={t("signals.strongDownCtx")} checked={!!filters.strong_down_sequence_context} onChange={() => toggleBool("strong_down_sequence_context")} />
          </div>
        )}

        {activeTab === "seq" && (
          <div
            role="tabpanel"
            id="panel-seq"
            aria-labelledby="tab-seq"
            className="space-y-5"
          >
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Breaks</p>
              <div className="flex flex-col gap-2">
                <Checkbox
                  label={t("seq.downBreakRecent")}
                  checked={!!filters.down_sequence_broke_recently}
                  onChange={() => toggleBool("down_sequence_broke_recently")}
                />
                <Checkbox
                  label={t("seq.upBreakRecent")}
                  checked={!!filters.up_sequence_broke_recently}
                  onChange={() => toggleBool("up_sequence_broke_recently")}
                />
                <Checkbox
                  label={t("seq.downBreakStrongUp")}
                  checked={!!filters.down_sequence_broke_in_strong_up_context}
                  onChange={() => toggleBool("down_sequence_broke_in_strong_up_context")}
                />
                <Checkbox
                  label={t("seq.upBreakStrongDown")}
                  checked={!!filters.up_sequence_broke_in_strong_down_context}
                  onChange={() => toggleBool("up_sequence_broke_in_strong_down_context")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("seq.upBreakWithin")}
                type="number"
                min="0"
                step="1"
                value={filters.up_sequence_break_bars_ago_lte ?? ""}
                onChange={(e) => setNum("up_sequence_break_bars_ago_lte", e.target.value)}
                placeholder="e.g. 3"
              />
              <Input
                label={t("seq.downBreakWithin")}
                type="number"
                min="0"
                step="1"
                value={filters.down_sequence_break_bars_ago_lte ?? ""}
                onChange={(e) => setNum("down_sequence_break_bars_ago_lte", e.target.value)}
                placeholder="e.g. 3"
              />
              <Input
                label={t("seq.upCountGte")}
                type="number"
                min="0"
                step="1"
                value={filters.up_sequence_count_gte ?? ""}
                onChange={(e) => setNum("up_sequence_count_gte", e.target.value)}
                placeholder="e.g. 3"
              />
              <Input
                label={t("seq.downCountGte")}
                type="number"
                min="0"
                step="1"
                value={filters.down_sequence_count_gte ?? ""}
                onChange={(e) => setNum("down_sequence_count_gte", e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
          </div>
        )}

        {activeTab === "bb" && (
          <div
            role="tabpanel"
            id="panel-bb"
            aria-labelledby="tab-bb"
            className="space-y-4"
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...filters,
                    pct_to_bb_upper_lte: filters.pct_to_bb_upper_lte !== undefined ? undefined : 2,
                  })
                }
              >
                {t("bb.nearUpper")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...filters,
                    pct_to_bb_lower_lte: filters.pct_to_bb_lower_lte !== undefined ? undefined : 2,
                  })
                }
              >
                {t("bb.nearLower")}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    label={t("bb.upperLte")}
                    type="number"
                    step="0.1"
                    value={filters.pct_to_bb_upper_lte ?? ""}
                    onChange={(e) => setNum("pct_to_bb_upper_lte", e.target.value)}
                    placeholder="2"
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0 mb-0.5" onClick={() => setNum("pct_to_bb_upper_lte", "2")}>
                  {t("bb.preset2")}
                </Button>
              </div>
              <Input
                label={t("bb.upperGte")}
                type="number"
                step="0.1"
                value={filters.pct_to_bb_upper_gte ?? ""}
                onChange={(e) => setNum("pct_to_bb_upper_gte", e.target.value)}
                placeholder="e.g. 5"
              />
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    label={t("bb.lowerLte")}
                    type="number"
                    step="0.1"
                    value={filters.pct_to_bb_lower_lte ?? ""}
                    onChange={(e) => setNum("pct_to_bb_lower_lte", e.target.value)}
                    placeholder="2"
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0 mb-0.5" onClick={() => setNum("pct_to_bb_lower_lte", "2")}>
                  {t("bb.preset2")}
                </Button>
              </div>
              <Input
                label={t("bb.lowerGte")}
                type="number"
                step="0.1"
                value={filters.pct_to_bb_lower_gte ?? ""}
                onChange={(e) => setNum("pct_to_bb_lower_gte", e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
          </div>
        )}

        {activeTab === "vol" && (
          <div
            role="tabpanel"
            id="panel-vol"
            aria-labelledby="tab-vol"
            className="space-y-4"
          >
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{t("atr.label")}</p>
            <div className="flex flex-wrap gap-5">
              <div className="w-44">
                <Input
                  label={`${t("atr.label")} ${t("atr.lessThan")}`}
                  type="number"
                  step="0.1"
                  min="0"
                  value={filters.atr_percent_lt ?? ""}
                  onChange={(e) => setNum("atr_percent_lt", e.target.value)}
                  placeholder="e.g. 3"
                />
              </div>
              <div className="w-44">
                <Input
                  label={`${t("atr.label")} ${t("atr.greaterThan")}`}
                  type="number"
                  step="0.1"
                  min="0"
                  value={filters.atr_percent_gt ?? ""}
                  onChange={(e) => setNum("atr_percent_gt", e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
            </div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{t("atr.dollar")}</p>
            <div className="flex flex-wrap gap-5">
              <div className="w-44">
                <Input
                  label={t("atr.dollarLt")}
                  type="number"
                  step="0.01"
                  min="0"
                  value={filters.atr_14_lt ?? ""}
                  onChange={(e) => setNum("atr_14_lt", e.target.value)}
                  placeholder="e.g. 2"
                />
              </div>
              <div className="w-44">
                <Input
                  label={t("atr.dollarGt")}
                  type="number"
                  step="0.01"
                  min="0"
                  value={filters.atr_14_gt ?? ""}
                  onChange={(e) => setNum("atr_14_gt", e.target.value)}
                  placeholder="e.g. 8"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "price" && (
          <div
            role="tabpanel"
            id="panel-price"
            aria-labelledby="tab-price"
            className="space-y-4"
          >
            <p className="text-sm text-text-secondary">{t("price.hint")}</p>
            <div className="flex flex-wrap gap-5">
              <div className="w-44">
                <Input
                  label={t("price.closeGte")}
                  type="number"
                  step="0.01"
                  min="0"
                  value={filters.close_gte ?? ""}
                  onChange={(e) => setNum("close_gte", e.target.value)}
                  placeholder="e.g. 50"
                />
              </div>
              <div className="w-44">
                <Input
                  label={t("price.closeLte")}
                  type="number"
                  step="0.01"
                  min="0"
                  value={filters.close_lte ?? ""}
                  onChange={(e) => setNum("close_lte", e.target.value)}
                  placeholder="e.g. 200"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
