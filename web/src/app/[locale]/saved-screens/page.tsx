"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { countActiveFilters, screenToQueryString } from "@/lib/screener-query";
import type { ScreenerPayload } from "@/lib/screener-types";

interface SavedScreen {
  id: string;
  name: string;
  filter_json: ScreenerPayload | null;
  updated_at: string;
}

interface AlertRow {
  id: string;
  saved_screen_id: string;
  enabled: boolean;
  last_checked_at: string | null;
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function PremiumStar() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5 text-warning"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function AlertToggle({
  enabled,
  loading,
  canUseAlerts,
  onToggle,
  lastCheckedAt,
  t,
}: {
  enabled: boolean;
  loading: boolean;
  canUseAlerts: boolean;
  onToggle: (next: boolean) => void;
  lastCheckedAt: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!canUseAlerts) {
    return (
      <div title={t("savedScreens.alertsPremiumHint")}>
        <Button
          size="sm"
          variant="ghost"
          disabled
          className="justify-center border border-dashed border-amber-400/20 bg-warning-soft/55 text-warning hover:bg-warning-soft/70"
        >
          <PremiumStar />
          {t("savedScreens.enableAlerts")}
          <span className="rounded-full border border-amber-400/25 bg-warning-soft/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
            {t("savedScreens.alertsPremium")}
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-medium text-text-secondary">
          {t("savedScreens.alertsLabel")}
        </span>
        <button
          role="switch"
          aria-checked={enabled}
          disabled={loading}
          onClick={() => onToggle(!enabled)}
          className={clsx(
            "relative inline-flex h-[22px] w-10 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            enabled ? "bg-[color:var(--color-neon)]" : "bg-border-strong",
            loading && "cursor-not-allowed opacity-60"
          )}
        >
          <span
            className={clsx(
              "pointer-events-none block h-[14px] w-[14px] transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
              enabled ? "translate-x-[20px]" : "translate-x-[2px]"
            )}
          />
        </button>
        {loading ? (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : null}
      </div>
      {enabled && lastCheckedAt ? (
        <span className="text-[10px] text-text-muted">
          {t("savedScreens.lastChecked", {
            time: new Date(lastCheckedAt).toLocaleString(),
          })}
        </span>
      ) : null}
    </div>
  );
}

function ScreenCard({
  screen,
  alert,
  canUseAlerts,
  onApply,
  onToggleAlert,
  t,
}: {
  screen: SavedScreen;
  alert: AlertRow | null;
  canUseAlerts: boolean;
  onApply: () => void;
  onToggleAlert: (screenId: string, next: boolean) => Promise<void>;
  t: ReturnType<typeof useTranslations>;
}) {
  const [toggling, setToggling] = useState(false);
  const filterCount = screen.filter_json ? countActiveFilters(screen.filter_json) : 0;
  const alertEnabled = alert?.enabled ?? false;

  async function handleToggle(next: boolean) {
    setToggling(true);
    try {
      await onToggleAlert(screen.id, next);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      className={clsx(
        "page-card relative flex flex-col gap-4 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between",
        alertEnabled && "ring-1 ring-[color:var(--color-neon)]/20 shadow-[0_0_0_1px_var(--color-neon-soft)]"
      )}
    >
      {alertEnabled ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-[color:var(--color-neon)] to-transparent opacity-60" />
      ) : null}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          {alertEnabled ? (
            <BellIcon className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-neon)]" />
          ) : null}
          <h3 className="truncate font-bold text-text">{screen.name}</h3>
          {alertEnabled ? (
            <span className="inline-flex items-center rounded-full bg-[color:var(--color-neon-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[color:var(--color-neon-strong)]">
              {t("savedScreens.watching")}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-text-secondary">
          {new Date(screen.updated_at).toLocaleDateString()}
          <span className="mx-1.5 opacity-40">·</span>
          <span>
            {filterCount}{" "}
            {filterCount === 1
              ? t("savedScreens.filterSingular")
              : t("savedScreens.filterPlural")}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button size="sm" variant="secondary" onClick={onApply}>
          {t("savedScreens.viewScan")}
        </Button>
        <AlertToggle
          enabled={alertEnabled}
          loading={toggling}
          canUseAlerts={canUseAlerts}
          onToggle={handleToggle}
          lastCheckedAt={alert?.last_checked_at ?? null}
          t={t}
        />
      </div>
    </div>
  );
}

export default function SavedScreensPage() {
  const t = useTranslations();
  const router = useRouter();
  const [screens, setScreens] = useState<SavedScreen[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [canUseAlerts, setCanUseAlerts] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [screensRes, entitlementRes] = await Promise.all([
        fetch("/api/saved-screens"),
        fetch("/api/me/entitlement"),
      ]);

      if (screensRes.status === 401) {
        router.replace("/auth/login");
        return;
      }
      if (screensRes.status === 403) {
        router.replace("/settings");
        return;
      }

      const screensData = await screensRes.json();
      setScreens(screensData.screens ?? []);

      const entData = await entitlementRes.json();
      const alertsAllowed = !!entData?.canUseAlerts;
      setCanUseAlerts(alertsAllowed);

      if (alertsAllowed) {
        const alertsRes = await fetch("/api/alerts");
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setAlerts(alertsData.alerts ?? []);
        }
      } else {
        setAlerts([]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  function applyScreen(screen: SavedScreen) {
    router.push(`/screener${screen.filter_json ? screenToQueryString(screen.filter_json) : ""}`);
  }

  async function handleToggleAlert(savedScreenId: string, next: boolean) {
    setAlerts((prev) => {
      const existing = prev.find((alert) => alert.saved_screen_id === savedScreenId);
      if (existing) {
        return prev.map((alert) =>
          alert.saved_screen_id === savedScreenId ? { ...alert, enabled: next } : alert
        );
      }
      return [
        ...prev,
        { id: "", saved_screen_id: savedScreenId, enabled: next, last_checked_at: null },
      ];
    });

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved_screen_id: savedScreenId, enabled: next }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.alert) {
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.saved_screen_id === savedScreenId ? data.alert : alert
          )
        );
      }
    } catch {
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.saved_screen_id === savedScreenId
            ? { ...alert, enabled: !next }
            : alert
        )
      );
    }
  }

  const alertMap = useMemo(
    () => new Map(alerts.map((alert) => [alert.saved_screen_id, alert])),
    [alerts]
  );

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
    <div className="page-shell page-stack max-w-4xl">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="page-hero !p-0">
          <h1 className="text-3xl font-bold tracking-tight text-text">{t("savedScreens.title")}</h1>
          <p className="max-w-xl text-sm text-text-secondary">{t("savedScreens.subtitle")}</p>
        </div>
        <Link href="/screener">
          <Button size="sm" variant="secondary" className="mt-2 sm:mt-0">
            {t("savedScreens.goToScreener")}
          </Button>
        </Link>
      </div>

      {screens.length > 0 && canUseAlerts ? (
        <div className="flex items-center gap-3 rounded-xl border border-[color:var(--color-neon)]/20 bg-[color:var(--color-neon-soft)] px-4 py-2.5">
          <BellIcon className="h-4 w-4 flex-shrink-0 text-[color:var(--color-neon-strong)]" />
          <p className="text-xs font-medium text-[color:var(--color-neon-strong)]">
            {t("savedScreens.alertsHint")}
          </p>
        </div>
      ) : null}

      {screens.length === 0 ? (
        <div className="page-empty-state flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-accent">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-6 w-6 text-text-muted"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-text">{t("savedScreens.emptyTitle")}</p>
            <p className="mt-1 text-sm text-text-secondary">{t("savedScreens.emptyBody")}</p>
          </div>
          <Link href="/screener">
            <Button size="sm">{t("savedScreens.goToScreener")}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              alert={alertMap.get(screen.id) ?? null}
              canUseAlerts={canUseAlerts}
              onApply={() => applyScreen(screen)}
              onToggleAlert={handleToggleAlert}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}
