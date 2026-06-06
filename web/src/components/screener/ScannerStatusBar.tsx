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
        tone === "default" && "ui-badge-default"
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
    <div className="rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-alt)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
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
        <p className="mt-2 text-[11px] text-text-muted">{statusMessage}</p>
      ) : null}
    </div>
  );
}
