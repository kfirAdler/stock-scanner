"use client";

import { clsx } from "clsx";

export function SimilarityBadge({ score }: { score: number }) {
  const tone =
    score >= 90
      ? "bg-success-soft text-success ring-success/15"
      : score >= 75
        ? "bg-primary-soft text-primary ring-primary/10"
        : "bg-surface text-text-secondary ring-border";

  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", tone)}>
      {score}%
    </span>
  );
}
