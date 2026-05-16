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
        "ui-control inline-flex items-center gap-2 rounded-full text-text-secondary transition-colors hover:border-border-strong hover:text-text",
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
