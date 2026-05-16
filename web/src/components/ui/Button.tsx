"use client";

import { clsx } from "clsx";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[0_12px_28px_rgba(37,99,235,0.24)] hover:bg-primary-hover hover:shadow-[0_16px_32px_rgba(37,99,235,0.28)] active:scale-[0.98] focus-visible:ring-primary/50 disabled:bg-primary/55 disabled:text-on-primary/80 disabled:shadow-none",
  secondary:
    "ui-control border-border-strong text-text hover:border-border-strong active:scale-[0.98] focus-visible:ring-primary/50",
  ghost:
    "text-text-secondary hover:text-text hover:bg-surface-hover active:scale-[0.98] focus-visible:ring-primary/50",
  danger:
    "bg-danger text-on-danger shadow-[0_12px_24px_rgba(127,29,29,0.18)] hover:bg-[#cf8080] active:scale-[0.98] focus-visible:ring-danger/50 disabled:bg-danger/60 disabled:text-on-danger/80 disabled:shadow-none",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-2.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-lg font-bold",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          "disabled:pointer-events-none disabled:shadow-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
