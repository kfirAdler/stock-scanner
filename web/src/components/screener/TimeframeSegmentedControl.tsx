"use client";

import { clsx } from "clsx";
import type { ScreenerTimeframe } from "@/lib/screener-types";
import type { DensityMode } from "./DensityToggle";

interface TimeframeItem {
  id: ScreenerTimeframe;
  label: string;
  count: number;
}

interface TimeframeSegmentedControlProps {
  value: ScreenerTimeframe;
  onChange: (value: ScreenerTimeframe) => void;
  items: TimeframeItem[];
  density?: DensityMode;
}

export function TimeframeSegmentedControl({
  value,
  onChange,
  items,
  density = "compact",
}: TimeframeSegmentedControlProps) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-alt p-1 ring-1 ring-border dark:bg-[#111827] dark:ring-white/[0.05]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={clsx(
            "rounded-[14px] text-left transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt",
            density === "compact" ? "px-3 py-2" : "px-3.5 py-2.5",
            value === item.id
              ? "bg-primary-soft text-primary shadow-sm ring-1 ring-primary/10 dark:bg-[#24345c] dark:text-[#f8fafc] dark:ring-[rgba(99,102,241,0.2)]"
              : "text-text-secondary hover:bg-surface-raised/75 hover:text-text dark:text-[#cbd5e1] dark:hover:bg-[#1e293b] dark:hover:text-[#f8fafc]"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold">{item.label}</span>
            <span
              className={clsx(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                value === item.id
                  ? "bg-primary text-on-primary dark:bg-[#3657d6] dark:text-white"
                  : "bg-surface-raised text-text-muted ring-1 ring-border dark:bg-[#172033] dark:text-[#94a3b8] dark:ring-white/[0.05]"
              )}
            >
              {item.count}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
