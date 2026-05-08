"use client";

import { clsx } from "clsx";
import type { LookupCondition } from "./types";

type ConditionChipProps = {
  condition: LookupCondition;
  active?: boolean;
  onClick?: () => void;
};

export function ConditionChip({ condition, active = false, onClick }: ConditionChipProps) {
  const tone =
    condition.status === "match"
      ? "bg-success-soft text-success ring-success/15 hover:bg-success-soft/80"
      : condition.status === "near"
        ? "bg-primary-soft text-primary ring-primary/10 hover:bg-primary-soft/75"
        : "bg-surface text-text-secondary ring-border hover:bg-surface-alt";

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition-all duration-150",
        tone,
        active && "shadow-sm ring-border-strong"
      )}
    >
      <span className="text-[10px] uppercase tracking-[0.18em] opacity-75">{condition.timeframe}</span>
      <span>{condition.label}</span>
    </button>
  );
}
