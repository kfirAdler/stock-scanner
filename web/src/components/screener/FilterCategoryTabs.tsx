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
      <div className="inline-flex min-w-full gap-1 rounded-2xl bg-surface-alt p-1 ring-1 ring-border dark:bg-[#111827] dark:ring-white/[0.05]">
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
                  ? "bg-surface-raised text-text shadow-sm ring-1 ring-border dark:bg-[#172033] dark:text-[#f1f5f9] dark:ring-white/[0.06]"
                  : "text-text-muted hover:bg-surface-raised/75 hover:text-text-secondary dark:text-[#94a3b8] dark:hover:bg-[#1e293b] dark:hover:text-[#cbd5e1]"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active
                    ? "bg-primary-soft text-primary dark:bg-[#3657d6] dark:text-[#f8fafc]"
                    : "bg-surface-raised text-text-muted ring-1 ring-border dark:bg-[#172033] dark:text-[#94a3b8] dark:ring-white/[0.05]"
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
