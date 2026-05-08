"use client";

import { clsx } from "clsx";

type DensityMode = "compact" | "comfortable";

interface ActiveFilterPillProps {
  label: string;
  onRemove: () => void;
  density?: DensityMode;
}

export function ActiveFilterPill({
  label,
  onRemove,
  density = "compact",
}: ActiveFilterPillProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={clsx(
        "inline-flex items-center gap-2 rounded-full bg-surface-raised text-text-secondary ring-1 ring-border transition-colors hover:text-text hover:ring-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        density === "compact" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"
      )}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden="true" className="text-text-muted">
        ×
      </span>
    </button>
  );
}
