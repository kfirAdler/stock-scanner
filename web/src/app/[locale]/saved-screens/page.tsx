"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { countActiveFilters, screenToQueryString } from "@/lib/screener-query";
import type { ScreenerPayload } from "@/lib/screener-types";

interface SavedScreen {
  id: string;
  name: string;
  filter_json: ScreenerPayload | null;
  updated_at: string;
}

function PremiumStar() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5 text-amber-500"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export default function SavedScreensPage() {
  const t = useTranslations();
  const router = useRouter();
  const [screens, setScreens] = useState<SavedScreen[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-screens");
      if (res.status === 401) {
        router.replace("/auth/login");
        return;
      }
      if (res.status === 403) {
        router.replace("/settings");
        return;
      }
      const data = await res.json();
      setScreens(data.screens ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function applyScreen(screen: SavedScreen) {
    router.push(`/screener${screen.filter_json ? screenToQueryString(screen.filter_json) : ""}`);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
        >
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-bold">{t("savedScreens.title")}</h1>
      <p className="max-w-2xl text-sm text-text-secondary">
        {t("savedScreens.subtitle")}
      </p>

      {screens.length === 0 ? (
        <p className="py-12 text-center text-text-secondary">
          {t("savedScreens.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {screens.map((screen) => (
            <div
              key={screen.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-bold">{screen.name}</h3>
                <p className="mt-1 text-xs text-text-secondary">
                  {new Date(screen.updated_at).toLocaleDateString()}
                  {" · "}
                  {screen.filter_json ? countActiveFilters(screen.filter_json) : 0} filters
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button size="sm" variant="secondary" onClick={() => applyScreen(screen)}>
                  {t("savedScreens.viewScan")}
                </Button>
                <div title={t("savedScreens.alertsPremiumHint")}>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled
                    className="w-full justify-center border border-dashed border-amber-300/80 bg-amber-50/70 text-amber-900 hover:bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200 sm:w-auto"
                  >
                    <PremiumStar />
                    {t("savedScreens.enableAlerts")}
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-black/20 dark:text-amber-200">
                      {t("savedScreens.alertsPremium")}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
