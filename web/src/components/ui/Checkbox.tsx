"use client";

import { clsx } from "clsx";
import { type InputHTMLAttributes, forwardRef } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
      <label
        htmlFor={checkboxId}
        className={clsx(
          "inline-flex items-center gap-2 cursor-pointer select-none text-sm",
          props.disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className={clsx(
            "h-4 w-4 rounded border-border text-primary",
            "focus:ring-2 focus:ring-primary focus:ring-offset-2",
            "disabled:cursor-not-allowed"
          )}
          {...props}
        />
        <span>{label}</span>
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
