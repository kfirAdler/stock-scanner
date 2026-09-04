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
    <div className="ui-segment inline-flex items-center rounded-full p-1" role="group">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={clsx(
            "min-h-8 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
            value === option.id
              ? "ui-segment-item-active"
              : "ui-segment-item hover:text-text-secondary"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
