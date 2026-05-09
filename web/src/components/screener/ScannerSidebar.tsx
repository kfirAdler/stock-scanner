"use client";

import type { ReactNode } from "react";

interface ScannerSidebarProps {
  title: string;
  subtitle?: string;
  filterCount: number;
  onClose?: () => void;
  statusBar: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}

export function ScannerSidebar({
  title,
  subtitle,
  filterCount,
  onClose,
  statusBar,
  children,
  footer,
}: ScannerSidebarProps) {
  return (
    <aside className="overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,253,0.98))] shadow-[0_20px_48px_rgba(15,23,42,0.06)] ring-1 ring-border dark:bg-[radial-gradient(circle_at_top,rgba(79,110,247,0.12),transparent_38%),linear-gradient(180deg,rgba(19,28,47,0.96),rgba(13,19,33,0.98))] dark:shadow-[0_28px_80px_rgba(2,6,23,0.55)] dark:ring-white/[0.05]">
      <div className="border-b border-border/70 px-4 py-3 dark:border-white/[0.05]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">
              Scanner
            </p>
            <h2 className="mt-1 text-[17px] font-bold tracking-tight text-text">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-primary-soft px-2 py-1 text-[11px] font-bold text-primary ring-1 ring-primary/10">
              {filterCount}
            </span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-text-muted ring-1 ring-border transition-colors hover:text-text dark:bg-white/[0.04] dark:ring-white/[0.06] dark:hover:bg-white/[0.07]"
                aria-label="Close filters"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-10 border-b border-border/60 bg-surface-raised/94 px-4 py-2.5 backdrop-blur dark:border-white/[0.05] dark:bg-[rgba(17,24,39,0.82)]">
        {statusBar}
      </div>

      <div className="space-y-4 px-4 py-3.5">{children}</div>

      <div className="sticky bottom-0 border-t border-border/70 bg-surface-raised/96 px-4 py-2.5 backdrop-blur dark:border-white/[0.05] dark:bg-[rgba(18,25,40,0.9)]">
        {footer}
      </div>
    </aside>
  );
}
