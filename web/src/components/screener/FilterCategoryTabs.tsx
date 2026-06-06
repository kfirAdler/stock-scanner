"use client";

import { clsx } from "clsx";
import type { DensityMode } from "./DensityToggle";

interface CategoryTabItem {
  id: string;
  label: string;
  count: number;
}

interface FilterCategoryTabsProps {
  tabs: CategoryTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  density?: DensityMode;
}

export function FilterCategoryTabs({
  tabs,
  activeTab,
  onChange,
  density = "compact",
}: FilterCategoryTabsProps) {
  return (
    <div className="overflow-x-auto">
      <div className="ui-segment inline-flex min-w-full gap-1 rounded-2xl p-1">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-[14px] font-semibold whitespace-nowrap transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt",
                density === "compact" ? "px-2.5 py-2 text-[11px]" : "px-3 py-2.5 text-[12px]",
                active
                  ? "ui-segment-item-active"
                  : "ui-segment-item hover:text-text-secondary"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active
                    ? "bg-primary/90 text-on-primary"
                    : "ui-badge-default"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
