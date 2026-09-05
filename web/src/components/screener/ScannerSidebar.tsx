"use client";

import type { ReactNode } from "react";

interface ScannerSidebarProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  filterCount: number;
  closeLabel: string;
  onClose?: () => void;
  statusBar: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}

export function ScannerSidebar({
  eyebrow,
  title,
  subtitle,
  filterCount,
  closeLabel,
  onClose,
  statusBar,
  children,
  footer,
}: ScannerSidebarProps) {
  return (
    <aside className="rounded-[24px] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-[var(--color-shadow-panel-strong)]">
      <div className="sticky top-0 z-20 border-b border-border/70 bg-[color:var(--color-surface-raised)] px-4 py-3 xl:static">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">
              {eyebrow}
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
                data-autofocus
                className="ui-control inline-flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text"
                aria-label={closeLabel}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-b border-border/60 bg-[color:var(--color-surface-raised)] px-4 py-2.5 xl:sticky xl:top-0 xl:z-10">
        {statusBar}
      </div>

      <div className="space-y-4 bg-[color:var(--color-surface-raised)] px-4 py-3.5">{children}</div>

      <div className="sticky bottom-0 z-20 rounded-b-[24px] border-t border-border/70 bg-[color:var(--color-surface-overlay)] px-4 py-2.5 backdrop-blur-xl">
        {footer}
      </div>
    </aside>
  );
}
