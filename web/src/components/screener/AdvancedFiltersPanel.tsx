"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

interface AdvancedFiltersPanelProps {
  open: boolean;
  onToggle: () => void;
  title: string;
  children: ReactNode;
}

export function AdvancedFiltersPanel({
  open,
  onToggle,
  title,
  children,
}: AdvancedFiltersPanelProps) {
  return (
    <section className="rounded-2xl bg-surface-alt/55 ring-1 ring-border dark:bg-[#111827] dark:ring-white/[0.05]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
          {title}
        </p>
        <span
          className={clsx(
            "inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised text-text-muted ring-1 ring-border transition-transform",
            "dark:bg-[#172033] dark:ring-white/[0.05]",
            open && "rotate-180"
          )}
          aria-hidden="true"
        >
          ˅
        </span>
      </button>
      {open ? <div className="border-t border-border/80 px-4 py-3 dark:border-white/[0.05]">{children}</div> : null}
    </section>
  );
}
