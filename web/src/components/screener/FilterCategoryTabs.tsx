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
      <div className="inline-flex min-w-full gap-1 rounded-2xl bg-surface-alt p-1 ring-1 ring-border dark:bg-white/[0.035] dark:ring-white/[0.05]">
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
                  ? "bg-surface-raised text-text shadow-sm ring-1 ring-border dark:bg-white/[0.07] dark:ring-white/[0.06]"
                  : "text-text-muted hover:bg-surface-raised/75 hover:text-text-secondary dark:hover:bg-white/[0.05]"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active
                    ? "bg-primary-soft text-primary"
                    : "bg-surface-raised text-text-muted ring-1 ring-border dark:bg-white/[0.05] dark:ring-white/[0.05]"
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
