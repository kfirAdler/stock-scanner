"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";

interface SavedScreen {
  id: string;
  name: string;
  filter_json: Record<string, unknown>;
  updated_at: string;
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
      const data = await res.json();
      setScreens(data.screens ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function applyScreen(screen: SavedScreen) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(screen.filter_json)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
    router.push(`/screener?${params.toString()}`);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" role="status">
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("savedScreens.title")}</h1>
      <p className="text-sm text-text-secondary max-w-2xl">{t("savedScreens.subtitle")}</p>

      {screens.length === 0 ? (
        <p className="text-text-secondary py-12 text-center">{t("savedScreens.empty")}</p>
      ) : (
        <div className="space-y-3">
          {screens.map((screen) => (
            <div
              key={screen.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
            >
              <div>
                <h3 className="font-bold">{screen.name}</h3>
                <p className="text-xs text-text-secondary mt-1">
                  {new Date(screen.updated_at).toLocaleDateString()}
                  {" · "}
                  {Object.keys(screen.filter_json).length} filters
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => applyScreen(screen)}>
                  {t("savedScreens.viewScan")}
                </Button>
                <Button size="sm" variant="ghost" disabled title={t("savedScreens.alertsComingSoon")}>
                  {t("savedScreens.enableAlerts")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
