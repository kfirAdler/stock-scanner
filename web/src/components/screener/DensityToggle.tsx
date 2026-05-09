"use client";

import { clsx } from "clsx";

export type DensityMode = "compact" | "comfortable";

interface DensityToggleProps {
  value: DensityMode;
  onChange: (value: DensityMode) => void;
  compactLabel: string;
  comfortableLabel: string;
}

export function DensityToggle({
  value,
  onChange,
  compactLabel,
  comfortableLabel,
}: DensityToggleProps) {
  const options: { id: DensityMode; label: string }[] = [
    { id: "compact", label: compactLabel },
    { id: "comfortable", label: comfortableLabel },
  ];

  return (
    <div className="inline-flex items-center rounded-full bg-surface-alt p-1 ring-1 ring-border dark:bg-white/[0.035] dark:ring-white/[0.05]">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={clsx(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
            value === option.id
              ? "bg-surface-raised text-text shadow-sm ring-1 ring-border dark:bg-white/[0.07] dark:ring-white/[0.06]"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
