"use client";

import { useState } from "react";
import { clsx } from "clsx";

export function Tooltip({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={clsx("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-surface text-[10px] font-bold text-text-muted"
        aria-label={content}
      >
        ?
      </button>
      {open && (
        <span className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-left text-[11px] font-medium leading-relaxed text-text shadow-lg">
          {content}
        </span>
      )}
    </span>
  );
}
