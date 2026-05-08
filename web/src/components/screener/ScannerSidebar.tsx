"use client";

import type { ReactNode } from "react";

interface ScannerSidebarProps {
  title: string;
  subtitle: string;
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
    <aside className="overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,251,255,0.98))] shadow-[0_26px_65px_rgba(15,23,42,0.08)] ring-1 ring-border dark:bg-[linear-gradient(180deg,rgba(6,12,18,0.98),rgba(8,16,24,0.98))] dark:shadow-[0_28px_70px_rgba(0,0,0,0.7)] dark:ring-[#183241]">
      <div className="border-b border-border/80 px-4 py-4 dark:border-[#183241]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">
              Scanner
            </p>
            <h2 className="mt-1 text-[17px] font-bold tracking-tight text-text">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-primary-soft px-2 py-1 text-[11px] font-bold text-primary ring-1 ring-primary/10">
              {filterCount}
            </span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-text-muted ring-1 ring-border transition-colors hover:text-text"
                aria-label="Close filters"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-10 border-b border-border/70 bg-surface-raised/92 px-4 py-3 backdrop-blur dark:border-[#183241] dark:bg-[#071019eb]">
        {statusBar}
      </div>

      <div className="space-y-5 px-4 py-4">{children}</div>

      <div className="sticky bottom-0 border-t border-border/70 bg-surface-raised/94 px-4 py-3 backdrop-blur dark:border-[#183241] dark:bg-[#071019f0]">
        {footer}
      </div>
    </aside>
  );
}
