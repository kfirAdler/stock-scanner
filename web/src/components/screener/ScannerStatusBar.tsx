"use client";

import { clsx } from "clsx";

interface ScannerStatusBarProps {
  syncLabel: string;
  pending: boolean;
  activeFilters: number;
  appliedFiltersLabel: string;
  resultCount: number;
  resultLabel: string;
  updatedLabel?: string | null;
  statusMessage?: string | null;
}

function StatusBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "primary" && "bg-primary-soft text-primary ring-1 ring-primary/10",
        tone === "success" && "bg-success-soft text-success ring-1 ring-success/10",
        tone === "warning" && "bg-warning-soft text-warning ring-1 ring-warning/10",
        tone === "default" && "bg-surface-raised text-text-secondary ring-1 ring-border dark:bg-[#0f1828] dark:text-[#d9e4f2] dark:ring-white/[0.05]",
        tone === "primary" && "dark:bg-[#162447] dark:text-[#f8fafc] dark:ring-[rgba(99,102,241,0.2)]",
        tone === "success" && "dark:bg-[rgba(29,78,53,0.42)] dark:text-[#7dffb1] dark:ring-[rgba(34,197,94,0.22)]",
        tone === "warning" && "dark:bg-[rgba(133,77,14,0.32)] dark:text-[#f4d38d] dark:ring-[rgba(245,158,11,0.2)]"
      )}
    >
      {label}
    </span>
  );
}

export function ScannerStatusBar({
  syncLabel,
  pending,
  activeFilters,
  appliedFiltersLabel,
  resultCount,
  resultLabel,
  updatedLabel,
  statusMessage,
}: ScannerStatusBarProps) {
  return (
    <div className="rounded-2xl bg-surface-alt/90 p-3 ring-1 ring-border dark:bg-[#0f1828] dark:ring-white/[0.05]">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={syncLabel}
          tone={pending ? "warning" : "success"}
        />
        <StatusBadge label={`${activeFilters} ${appliedFiltersLabel}`} tone="primary" />
        <StatusBadge label={`${resultCount} ${resultLabel}`} />
        {updatedLabel ? <StatusBadge label={updatedLabel} /> : null}
      </div>
      {statusMessage ? (
        <p className="mt-2 text-[11px] text-text-muted dark:text-[#8ea0b9]">{statusMessage}</p>
      ) : null}
    </div>
  );
}
