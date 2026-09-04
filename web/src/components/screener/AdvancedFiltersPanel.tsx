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
  const panelId = "advanced-scanner-filters";

  return (
    <section className="ui-panel-subtle rounded-2xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-start"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
          {title}
        </p>
        <span
          className={clsx(
            "ui-control inline-flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-transform",
            open && "rotate-180"
          )}
          aria-hidden="true"
        >
          ˅
        </span>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-border/80 px-4 py-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
