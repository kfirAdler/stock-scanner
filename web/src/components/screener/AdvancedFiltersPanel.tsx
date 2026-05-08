"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

interface AdvancedFiltersPanelProps {
  open: boolean;
  onToggle: () => void;
  title: string;
  hint?: string;
  children: ReactNode;
}

export function AdvancedFiltersPanel({
  open,
  onToggle,
  title,
  hint,
  children,
}: AdvancedFiltersPanelProps) {
  return (
    <section className="rounded-2xl bg-surface-alt/70 ring-1 ring-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
            {title}
          </p>
          {hint ? <p className="mt-1 text-xs text-text-secondary">{hint}</p> : null}
        </div>
        <span
          className={clsx(
            "inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-text-muted ring-1 ring-border transition-transform",
            open && "rotate-180"
          )}
          aria-hidden="true"
        >
          ˅
        </span>
      </button>
      {open ? <div className="border-t border-border/80 px-4 py-4">{children}</div> : null}
    </section>
  );
}
