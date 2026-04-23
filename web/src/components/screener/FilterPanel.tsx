"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { ScreenerFilters } from "@/lib/screener-types";

type TabId = "ma" | "bb" | "seq" | "vol" | "price";

interface FilterPanelProps {
  filters: ScreenerFilters;
  onChange: (filters: ScreenerFilters) => void;
  onApply: () => void;
  loading?: boolean;
}

export function FilterPanel({ filters, onChange, onApply, loading }: FilterPanelProps) {
  const t = useTranslations("screener");
  const [activeTab, setActiveTab] = useState<TabId>("ma");

  const tabs: { id: TabId; label: string }[] = [
    { id: "ma", label: t("tabs.movingAverages") },
    { id: "bb", label: t("tabs.bands") },
    { id: "seq", label: t("tabs.sequences") },
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
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={activeFilterCount === 0}>
            {t("clearFilters")}
          </Button>
          <Button size="sm" onClick={onApply} loading={loading}>
            {t("applyFilters")}
          </Button>
        </div>
      </div>

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
              "relative shrink-0 px-5 py-3 text-xs font-bold transition-colors",
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
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">SMA {period}</p>
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

        {activeTab === "bb" && (
          <div
            role="tabpanel"
            id="panel-bb"
            aria-labelledby="tab-bb"
            className="flex flex-wrap gap-6"
          >
            <Checkbox
              label={t("bb.nearUpper")}
              checked={filters.pct_to_bb_upper_lte !== undefined}
              onChange={() =>
                onChange({
                  ...filters,
                  pct_to_bb_upper_lte: filters.pct_to_bb_upper_lte !== undefined ? undefined : 2,
                })
              }
            />
            <Checkbox
              label={t("bb.nearLower")}
              checked={filters.pct_to_bb_lower_lte !== undefined}
              onChange={() =>
                onChange({
                  ...filters,
                  pct_to_bb_lower_lte: filters.pct_to_bb_lower_lte !== undefined ? undefined : 2,
                })
              }
            />
          </div>
        )}

        {activeTab === "seq" && (
          <div
            role="tabpanel"
            id="panel-seq"
            aria-labelledby="tab-seq"
            className="space-y-3"
          >
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
          </div>
        )}

        {activeTab === "vol" && (
          <div
            role="tabpanel"
            id="panel-vol"
            aria-labelledby="tab-vol"
            className="flex flex-wrap gap-5 items-end"
          >
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
        )}

        {activeTab === "price" && (
          <div
            role="tabpanel"
            id="panel-price"
            aria-labelledby="tab-price"
            className="flex items-center gap-3 text-sm text-text-muted py-4"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-alt text-text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
            </span>
            Price & Fundamentals filters coming soon.
          </div>
        )}
      </div>
    </div>
  );
}
