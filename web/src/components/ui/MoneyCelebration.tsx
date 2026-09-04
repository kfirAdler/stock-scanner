"use client";

import type { CSSProperties } from "react";

const BILL_PARTICLES = [
  [3, 0, 2.2, 42, -18, 0.78],
  [8, 0.18, 2.45, -35, 12, 0.9],
  [13, 0.08, 2.1, 64, -8, 0.72],
  [18, 0.35, 2.35, -48, 20, 1],
  [24, 0.12, 2.55, 31, -15, 0.84],
  [30, 0.42, 2.25, -58, 9, 0.76],
  [36, 0.03, 2.4, 46, -22, 0.94],
  [42, 0.28, 2.15, -30, 18, 0.82],
  [48, 0.5, 2.5, 55, -10, 0.74],
  [54, 0.14, 2.3, -43, 14, 1],
  [60, 0.38, 2.6, 37, -20, 0.88],
  [66, 0.06, 2.2, -62, 16, 0.8],
  [72, 0.45, 2.45, 49, -12, 0.92],
  [78, 0.2, 2.15, -34, 21, 0.75],
  [84, 0.32, 2.55, 61, -16, 0.86],
  [90, 0.1, 2.3, -51, 11, 0.96],
  [96, 0.4, 2.4, 28, -19, 0.79],
] as const;

interface MoneyCelebrationProps {
  message: string;
}

export function MoneyCelebration({ message }: MoneyCelebrationProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <div
        className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-2 rounded-full border border-success/25 bg-success-soft px-4 py-2.5 text-sm font-bold text-success shadow-[0_16px_42px_rgba(22,163,74,0.2)] backdrop-blur-md"
        role="status"
        aria-live="polite"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-xs text-white" aria-hidden="true">
          ✓
        </span>
        {message}
      </div>

      <div aria-hidden="true">
        {BILL_PARTICLES.map(([left, delay, duration, drift, rotation, scale], index) => (
          <span
            key={`${left}-${delay}`}
            className="money-confetti-bill"
            style={
              {
                "--money-left": `${left}%`,
                "--money-delay": `${delay}s`,
                "--money-duration": `${duration}s`,
                "--money-drift": `${drift}px`,
                "--money-rotation": `${rotation}deg`,
                "--money-scale": scale,
              } as CSSProperties
            }
          >
            <span>{index % 3 === 0 ? "$$" : "$"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
