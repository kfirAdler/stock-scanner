"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTransition } from "react";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const nextLocale = locale === "en" ? "he" : "en";
  const label = locale === "en" ? "עברית" : "English";

  function handleSwitch() {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <button
      onClick={handleSwitch}
      disabled={isPending}
      className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-sm font-bold text-text-secondary hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors disabled:opacity-50"
      aria-label={`Switch language to ${label}`}
    >
      {label}
    </button>
  );
}
