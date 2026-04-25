"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export function TermsAcceptanceGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function enforceTermsAcceptance() {
      if (pathname === "/terms") {
        return;
      }

      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401 || !res.ok) {
          return;
        }

        const data = await res.json();
        const latestTermsVersion = data?.latestTermsVersion ?? null;
        const needsAcceptance = latestTermsVersion !== CURRENT_TERMS_VERSION;

        if (!cancelled && needsAcceptance) {
          router.replace("/terms");
        }
      } catch {
        // ignore
      }
    }

    void enforceTermsAcceptance();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
