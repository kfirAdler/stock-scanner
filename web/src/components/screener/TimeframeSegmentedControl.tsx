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
    <div className="ui-segment grid grid-cols-3 gap-1 rounded-2xl p-1" role="group">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-pressed={value === item.id}
          className={clsx(
            "rounded-[14px] text-start transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt",
            density === "compact" ? "px-3 py-2" : "px-3.5 py-2.5",
            value === item.id
              ? "ui-segment-item-active text-text ring-1 ring-primary/20"
              : "ui-segment-item text-text-secondary hover:text-text"
          )}
        >
          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <span className="text-[12px] font-semibold">{item.label}</span>
            <span
              className={clsx(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                value === item.id
                  ? "bg-primary/90 text-on-primary"
                  : "ui-badge-default"
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
