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
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold">{t("filters")}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={clearAll}>
            {t("clearFilters")}
          </Button>
          <Button size="sm" onClick={onApply} loading={loading}>
            {t("applyFilters")}
          </Button>
        </div>
      </div>

      <div role="tablist" className="flex overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "shrink-0 px-4 py-2.5 text-sm font-bold transition-colors border-b-2",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === "ma" && (
          <div
            role="tabpanel"
            id="panel-ma"
            aria-labelledby="tab-ma"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          >
            {([20, 50, 150, 200] as const).map((period) => (
              <div key={period} className="space-y-2">
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
            className="flex flex-wrap gap-4"
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
            className="flex flex-wrap gap-4"
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
            className="flex flex-wrap gap-4 items-end"
          >
            <div className="w-40">
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
            <div className="w-40">
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
            className="text-sm text-text-secondary"
          >
            <p>Price & Fundamentals filters coming soon. Market cap data will be available in a future update.</p>
          </div>
        )}
      </div>
    </div>
  );
}
