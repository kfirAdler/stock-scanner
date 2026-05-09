"use client";

import { clsx } from "clsx";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ReactNode } from "react";

type DensityMode = "compact" | "comfortable";

interface FilterChipProps {
  active: boolean;
  label: ReactNode;
  onClick: () => void;
  tooltip?: string;
  density?: DensityMode;
}

export function FilterChip({
  active,
  label,
  onClick,
  tooltip,
  density = "compact",
}: FilterChipProps) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "inline-flex items-center rounded-full font-semibold transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          density === "compact" ? "min-h-7 px-2.5 py-1 text-[11px]" : "min-h-8 px-3 py-1.5 text-[12px]",
          active
            ? "bg-primary text-on-primary shadow-[0_10px_28px_rgba(30,64,175,0.22)] dark:bg-[linear-gradient(180deg,rgba(79,110,247,0.9),rgba(67,96,226,0.95))] dark:shadow-[0_12px_30px_rgba(79,110,247,0.22)]"
            : "bg-surface-raised text-text-secondary ring-1 ring-border hover:bg-surface hover:text-text hover:ring-border-strong dark:bg-white/[0.04] dark:ring-white/[0.05] dark:hover:bg-white/[0.06] dark:hover:ring-white/[0.08]"
        )}
      >
        {label}
      </button>
      {tooltip ? <Tooltip content={tooltip} /> : null}
    </div>
  );
}
