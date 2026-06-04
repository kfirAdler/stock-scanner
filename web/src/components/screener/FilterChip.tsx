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
            ? "border border-primary/35 bg-primary-soft text-primary shadow-[0_12px_30px_rgba(37,99,235,0.18)]"
            : "ui-control text-text-secondary hover:border-border-strong hover:text-text"
        )}
      >
        {label}
      </button>
      {tooltip ? <Tooltip content={tooltip} /> : null}
    </div>
  );
}
