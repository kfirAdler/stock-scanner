"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTransition } from "react";
import { clsx } from "clsx";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(nextLocale: "en" | "he") {
    if (locale === nextLocale) return;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-raised p-1 shadow-sm"
      aria-label="Language selector"
      dir="ltr"
    >
      <button
        type="button"
        onClick={() => switchLocale("en")}
        disabled={isPending}
        className={clsx(
          "rounded-full px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 sm:px-3",
          locale === "en"
            ? "bg-primary text-on-primary"
            : "text-text-secondary hover:bg-surface-alt hover:text-text"
        )}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchLocale("he")}
        disabled={isPending}
        className={clsx(
          "rounded-full px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 sm:px-3",
          locale === "he"
            ? "bg-primary text-on-primary"
            : "text-text-secondary hover:bg-surface-alt hover:text-text"
        )}
        aria-pressed={locale === "he"}
      >
        עברית
      </button>
    </div>
  );
}
