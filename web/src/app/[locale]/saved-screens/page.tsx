"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/hooks/useModalDialog";
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

type ScreenAction = "rename" | "duplicate";

interface RecentlyDeleted {
  screen: SavedScreen;
  alert: AlertRow | null;
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.5 5.5h13" />
      <path d="M7.2 5.5V3.7h5.6v1.8" />
      <path d="M5.3 5.5l.7 10.2h8l.7-10.2" />
      <path d="M8.3 8.5v4.7M11.7 8.5v4.7" />
    </svg>
  );
}

function AlertToggle({
  enabled,
  loading,
  disabled = false,
  canUseAlerts,
  onToggle,
  lastCheckedAt,
  locale,
  t,
}: {
  enabled: boolean;
  loading: boolean;
  disabled?: boolean;
  canUseAlerts: boolean;
  onToggle: (next: boolean) => void;
  lastCheckedAt: string | null;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!canUseAlerts) {
    return (
      <div className="w-full sm:w-auto" title={t("savedScreens.alertsPremiumHint")}>
        <Button
          size="sm"
          variant="ghost"
          disabled
          className="w-full justify-center border border-dashed border-amber-400/20 bg-warning-soft/55 text-warning hover:bg-warning-soft/70 sm:w-auto"
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
    <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-xs font-medium text-text-secondary">
          {t("savedScreens.alertsLabel")}
        </span>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={t("savedScreens.alertToggleLabel")}
          disabled={loading || disabled}
          onClick={() => onToggle(!enabled)}
          className={clsx(
            "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            enabled ? "bg-[color:var(--color-neon)]" : "bg-border-strong",
            (loading || disabled) && "cursor-not-allowed opacity-60"
          )}
        >
          <span
            className={clsx(
              "pointer-events-none block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
              enabled
                ? "ltr:translate-x-[22px] rtl:-translate-x-[22px]"
                : "ltr:translate-x-[2px] rtl:-translate-x-[2px]"
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
            time: new Date(lastCheckedAt).toLocaleString(locale),
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
  applying,
  navigationPending,
  onApply,
  onRename,
  onDuplicate,
  onDelete,
  onToggleAlert,
  locale,
  t,
}: {
  screen: SavedScreen;
  alert: AlertRow | null;
  canUseAlerts: boolean;
  applying: boolean;
  navigationPending: boolean;
  onApply: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleAlert: (screenId: string, next: boolean) => Promise<void>;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const [toggling, setToggling] = useState(false);
  const filterCount = screen.filter_json ? countActiveFilters(screen.filter_json) : 0;
  const alertEnabled = alert?.enabled ?? false;
  const discoveryGoal = screen.filter_json?.discovery_goal;

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
      aria-busy={applying || undefined}
      className={clsx(
        "page-card relative flex flex-col gap-4 !p-4 transition-all duration-200 sm:!p-5 md:flex-row md:items-center md:justify-between",
        alertEnabled && "ring-1 ring-[color:var(--color-neon)]/20 shadow-[0_0_0_1px_var(--color-neon-soft)]",
        applying && "border-primary/40 bg-primary-soft/30 ring-1 ring-primary/20"
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
          {new Date(screen.updated_at).toLocaleDateString(locale)}
          <span className="mx-1.5 opacity-40">·</span>
          <span>
            {filterCount}{" "}
            {filterCount === 1
              ? t("savedScreens.filterSingular")
              : t("savedScreens.filterPlural")}
          </span>
        </p>
        {discoveryGoal ? (
          <p className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold text-primary ring-1 ring-primary/10">
            <span aria-hidden="true">✦</span>
            {t(`screener.discovery.goals.${discoveryGoal}.title`)}
          </p>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-wrap md:items-center">
        <Button size="sm" variant="secondary" onClick={onApply} loading={applying} disabled={navigationPending} className="col-span-2 w-full md:w-auto">
          {t("savedScreens.viewScan")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRename} disabled={navigationPending} className="w-full md:w-auto">
          {t("savedScreens.rename")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDuplicate} disabled={navigationPending} className="w-full md:w-auto">
          {t("savedScreens.duplicate")}
        </Button>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between md:justify-end">
        <AlertToggle
          enabled={alertEnabled}
          loading={toggling}
          disabled={navigationPending}
          canUseAlerts={canUseAlerts}
          onToggle={handleToggle}
          lastCheckedAt={alert?.last_checked_at ?? null}
          locale={locale}
          t={t}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={navigationPending}
          className="w-full justify-center text-danger hover:bg-danger-soft hover:text-danger sm:w-auto"
        >
          <TrashIcon className="h-4 w-4" />
          {t("savedScreens.remove")}
        </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteScreenDialog({
  screen,
  loading,
  error,
  onCancel,
  onConfirm,
  t,
}: {
  screen: SavedScreen;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const dialogRef = useModalDialog<HTMLDivElement>({
    onClose: onCancel,
    closeDisabled: loading,
  });

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !loading) onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-text/55 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="ui-panel-strong max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[24px] shadow-[0_30px_80px_rgba(15,23,42,0.3)] sm:max-h-[calc(100dvh-2rem)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-screen-title"
        aria-describedby="delete-screen-description"
        aria-busy={loading}
        tabIndex={-1}
      >
        <div className="px-5 py-5">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger ring-1 ring-danger/15">
              <TrashIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-danger">
                {t("savedScreens.deleteDialogEyebrow")}
              </p>
              <h2 id="delete-screen-title" className="mt-1 break-words text-xl font-bold text-text">
                {t("savedScreens.deleteDialogTitle", { name: screen.name })}
              </h2>
              <p id="delete-screen-description" className="mt-2 text-sm leading-relaxed text-text-secondary">
                {t("savedScreens.deleteDialogBody")}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="ui-control inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-text-secondary transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
              aria-label={t("savedScreens.deleteDialogClose")}
            >
              ×
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-alt/45 px-5 py-3.5 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={loading} data-autofocus className="w-full sm:w-auto">
            {t("savedScreens.deleteCancel")}
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onConfirm} loading={loading} className="w-full sm:w-auto">
            {t("savedScreens.deleteConfirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScreenNameDialog({
  mode,
  screen,
  loading,
  error,
  onCancel,
  onConfirm,
  t,
}: {
  mode: ScreenAction;
  screen: SavedScreen;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (name: string) => Promise<void>;
  t: ReturnType<typeof useTranslations>;
}) {
  const [name, setName] = useState(
    mode === "duplicate" ? t("savedScreens.copyName", { name: screen.name }) : screen.name
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const dialogRef = useModalDialog<HTMLFormElement>({
    onClose: onCancel,
    closeDisabled: loading,
  });

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !loading) onCancel();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) {
      setNameError(t("savedScreens.nameRequired"));
      return;
    }
    setNameError(null);
    await onConfirm(normalized);
  }

  const titleId = `saved-screen-${mode}-title`;
  const descriptionId = `saved-screen-${mode}-description`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-text/55 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={handleBackdropClick}
    >
      <form
        ref={dialogRef}
        onSubmit={handleSubmit}
        className="ui-panel-strong max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[24px] shadow-[0_30px_80px_rgba(15,23,42,0.3)] sm:max-h-[calc(100dvh-2rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={loading}
        tabIndex={-1}
      >
        <div className="border-b border-border bg-surface-alt/55 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {t(`savedScreens.${mode}Eyebrow`)}
              </p>
              <h2 id={titleId} className="mt-1 text-xl font-bold text-text">
                {t(`savedScreens.${mode}Title`)}
              </h2>
              <p id={descriptionId} className="mt-1 text-sm text-text-secondary">
                {t(`savedScreens.${mode}Body`)}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="ui-control inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-text-secondary"
              aria-label={t("savedScreens.nameDialogClose")}
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-3 px-5 py-5">
          <label className="block text-xs font-bold text-text" htmlFor={`saved-screen-${mode}-name`}>
            {t("savedScreens.nameLabel")}
          </label>
          <input
            id={`saved-screen-${mode}-name`}
            data-autofocus
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
            className="ui-control min-h-11 w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            aria-invalid={!!(nameError || error)}
            aria-describedby={nameError || error ? `saved-screen-${mode}-error` : undefined}
          />
          {nameError || error ? (
            <p id={`saved-screen-${mode}-error`} className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger" role="alert">
              {nameError ?? error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-alt/45 px-5 py-3.5 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={loading} className="w-full sm:w-auto">
            {t("savedScreens.actionCancel")}
          </Button>
          <Button type="submit" size="sm" loading={loading} className="w-full sm:w-auto">
            {t(`savedScreens.${mode}Confirm`)}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function SavedScreensPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [screens, setScreens] = useState<SavedScreen[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [canUseAlerts, setCanUseAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedScreen | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<SavedScreen | null>(null);
  const [actionMode, setActionMode] = useState<ScreenAction>("rename");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "name">("recent");
  const [recentlyDeleted, setRecentlyDeleted] = useState<RecentlyDeleted | null>(null);
  const [applyingScreenId, setApplyingScreenId] = useState<string | null>(null);
  const [navigationPending, startNavigation] = useTransition();
  const toastTimerRef = useRef<number | null>(null);

  const loadAll = useCallback(async () => {
    setLoadError(null);
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
      setLoadError(t("savedScreens.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [router, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function applyScreen(screen: SavedScreen) {
    if (navigationPending) return;
    setApplyingScreenId(screen.id);
    const params = new URLSearchParams(
      screen.filter_json ? screenToQueryString(screen.filter_json).slice(1) : ""
    );
    params.set("saved_screen", screen.id);
    startNavigation(() => {
      router.push(`/screener?${params.toString()}`);
    });
  }

  function openDeleteDialog(screen: SavedScreen) {
    setDeleteError(null);
    setDeleteTarget(screen);
  }

  function openNameDialog(mode: ScreenAction, screen: SavedScreen) {
    setActionMode(mode);
    setActionError(null);
    setActionTarget(screen);
  }

  async function saveScreenAction(name: string) {
    if (!actionTarget?.filter_json) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/saved-screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(actionMode === "rename" ? { id: actionTarget.id } : {}),
          name,
          filter_json: actionTarget.filter_json,
        }),
      });
      if (!res.ok) throw new Error("Failed to save screen action");
      const data = (await res.json()) as { screen?: SavedScreen };
      if (!data.screen) throw new Error("Saved screen missing from response");
      const savedScreen = data.screen;

      setScreens((current) => actionMode === "rename"
        ? current.map((screen) => screen.id === savedScreen.id ? savedScreen : screen)
        : [savedScreen, ...current]
      );
      setActionTarget(null);
      setActionStatus(
        actionMode === "rename"
          ? t("savedScreens.renameSuccess", { name })
          : t("savedScreens.duplicateSuccess", { name })
      );
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setActionStatus(null);
        toastTimerRef.current = null;
      }, 4200);
    } catch {
      setActionError(t("savedScreens.actionFailed"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteScreen() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/saved-screens?id=${encodeURIComponent(target.id)}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        router.replace("/auth/login");
        return;
      }
      if (res.status === 403) {
        router.replace("/settings");
        return;
      }
      if (!res.ok) throw new Error("Failed to delete saved screen");

      setScreens((current) => current.filter((screen) => screen.id !== target.id));
      const targetAlert = alerts.find((alert) => alert.saved_screen_id === target.id) ?? null;
      setAlerts((current) => current.filter((alert) => alert.saved_screen_id !== target.id));
      setDeleteTarget(null);
      setRecentlyDeleted({ screen: target, alert: targetAlert });
      setActionStatus(null);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setRecentlyDeleted(null);
        toastTimerRef.current = null;
      }, 7000);
    } catch {
      setDeleteError(t("savedScreens.deleteFailed"));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function undoDelete() {
    if (!recentlyDeleted?.screen.filter_json) return;
    const deleted = recentlyDeleted;
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setRecentlyDeleted(null);
    setActionStatus(t("savedScreens.restoring"));

    try {
      const res = await fetch("/api/saved-screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deleted.screen.name,
          filter_json: deleted.screen.filter_json,
        }),
      });
      if (!res.ok) throw new Error("Failed to restore saved screen");
      const data = (await res.json()) as { screen?: SavedScreen };
      if (!data.screen) throw new Error("Restored screen missing from response");
      const restoredScreen = data.screen;

      setScreens((current) => [restoredScreen, ...current]);
      if (deleted.alert?.enabled) {
        const alertRes = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saved_screen_id: restoredScreen.id, enabled: true }),
        });
        if (alertRes.ok) {
          const alertData = await alertRes.json();
          if (alertData.alert) setAlerts((current) => [...current, alertData.alert]);
        }
      }
      setActionStatus(t("savedScreens.restoreSuccess", { name: deleted.screen.name }));
    } catch {
      setActionStatus(t("savedScreens.restoreFailed"));
    }

    toastTimerRef.current = window.setTimeout(() => {
      setActionStatus(null);
      toastTimerRef.current = null;
    }, 4500);
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
      setActionStatus(t("savedScreens.alertUpdateFailed"));
    }
  }

  const alertMap = useMemo(
    () => new Map(alerts.map((alert) => [alert.saved_screen_id, alert])),
    [alerts]
  );
  const visibleScreens = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase(locale);
    const filtered = normalizedQuery
      ? screens.filter((screen) => screen.name.toLocaleLowerCase(locale).includes(normalizedQuery))
      : screens;
    return [...filtered].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, locale);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [locale, screens, searchQuery, sortMode]);
  const activeAlerts = alerts.filter((alert) => alert.enabled).length;
  const mostRecentlyUpdated = screens.reduce<SavedScreen | null>((latest, screen) => {
    if (!latest) return screen;
    return new Date(screen.updated_at).getTime() > new Date(latest.updated_at).getTime()
      ? screen
      : latest;
  }, null);

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
    <div className="page-shell page-stack max-w-5xl">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="page-hero !p-0">
          <h1 className="text-3xl font-bold tracking-tight text-text">{t("savedScreens.title")}</h1>
          <p className="max-w-xl text-sm text-text-secondary">{t("savedScreens.subtitle")}</p>
        </div>
        <Link href="/screener" className="w-full sm:w-auto">
          <Button size="sm" variant="secondary" className="mt-2 w-full sm:mt-0 sm:w-auto">
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

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{loadError}</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void loadAll()}>
            {t("savedScreens.retry")}
          </Button>
        </div>
      ) : null}

      {screens.length > 0 ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={t("savedScreens.overviewLabel")}>
          <div className="premium-metric-card !p-3.5 sm:!p-5">
            <p className="premium-metric-label">{t("savedScreens.savedCountLabel")}</p>
            <p className="premium-metric-value">{screens.length}</p>
            <p className="premium-metric-meta">{t("savedScreens.savedCountMeta")}</p>
          </div>
          <div className="premium-metric-card !p-3.5 sm:!p-5">
            <p className="premium-metric-label">{t("savedScreens.activeAlertsLabel")}</p>
            <p className="premium-metric-value">{activeAlerts}</p>
            <p className="premium-metric-meta">{t("savedScreens.activeAlertsMeta")}</p>
          </div>
          <div className="premium-metric-card col-span-2 !p-3.5 sm:col-span-1 sm:!p-5">
            <p className="premium-metric-label">{t("savedScreens.lastSavedLabel")}</p>
            <p className="premium-metric-value text-base">
              {mostRecentlyUpdated
                ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(mostRecentlyUpdated.updated_at))
                : "—"}
            </p>
            <p className="premium-metric-meta">{t("savedScreens.lastSavedMeta")}</p>
          </div>
        </section>
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
          <div className="ui-panel-subtle flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative min-w-0 flex-1" htmlFor="saved-screen-search">
              <span className="sr-only">{t("savedScreens.searchLabel")}</span>
              <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">⌕</span>
              <input
                id="saved-screen-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("savedScreens.searchPlaceholder")}
                className="ui-control min-h-11 w-full rounded-xl ps-9 pe-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="flex w-full items-center gap-2 text-xs font-semibold text-text-secondary sm:w-auto" htmlFor="saved-screen-sort">
              {t("savedScreens.sortLabel")}
              <select
                id="saved-screen-sort"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as "recent" | "name")}
                className="ui-control min-h-11 min-w-0 flex-1 rounded-xl px-3 text-sm outline-none focus:border-primary sm:flex-none"
              >
                <option value="recent">{t("savedScreens.sortRecent")}</option>
                <option value="name">{t("savedScreens.sortName")}</option>
              </select>
            </label>
          </div>

          {visibleScreens.length === 0 ? (
            <div className="page-empty-state text-center">
              <p className="font-bold text-text">{t("savedScreens.noSearchResults")}</p>
              <button type="button" onClick={() => setSearchQuery("")} className="mt-2 min-h-10 text-sm font-bold text-primary hover:underline">
                {t("savedScreens.clearSearch")}
              </button>
            </div>
          ) : visibleScreens.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              alert={alertMap.get(screen.id) ?? null}
              canUseAlerts={canUseAlerts}
              applying={navigationPending && applyingScreenId === screen.id}
              navigationPending={navigationPending}
              onApply={() => applyScreen(screen)}
              onRename={() => openNameDialog("rename", screen)}
              onDuplicate={() => openNameDialog("duplicate", screen)}
              onDelete={() => openDeleteDialog(screen)}
              onToggleAlert={handleToggleAlert}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      )}

      {deleteTarget ? (
        <DeleteScreenDialog
          screen={deleteTarget}
          loading={deleteLoading}
          error={deleteError}
          onCancel={() => {
            if (!deleteLoading) setDeleteTarget(null);
          }}
          onConfirm={handleDeleteScreen}
          t={t}
        />
      ) : null}

      {actionTarget ? (
        <ScreenNameDialog
          key={`${actionMode}-${actionTarget.id}`}
          mode={actionMode}
          screen={actionTarget}
          loading={actionLoading}
          error={actionError}
          onCancel={() => {
            if (!actionLoading) setActionTarget(null);
          }}
          onConfirm={saveScreenAction}
          t={t}
        />
      ) : null}

      {recentlyDeleted ? (
        <div
          className="fixed inset-x-3 bottom-4 z-[90] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border-strong bg-surface-overlay px-4 py-3 text-sm font-bold text-text shadow-[var(--color-shadow-overlay)] backdrop-blur-md sm:bottom-6"
          role="status"
          aria-live="polite"
        >
          <span className="min-w-0 truncate">
            {t("savedScreens.deleteSuccess", { name: recentlyDeleted.screen.name })}
          </span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void undoDelete()}>
            {t("savedScreens.undo")}
          </Button>
        </div>
      ) : null}

      {actionStatus ? (
        <div
          className="fixed inset-x-3 bottom-4 z-[90] mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-success/25 bg-success-soft px-4 py-3 text-sm font-bold text-success shadow-[0_16px_42px_rgba(22,163,74,0.2)] backdrop-blur-md sm:bottom-6"
          role="status"
          aria-live="polite"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-xs text-white" aria-hidden="true">✓</span>
          {actionStatus}
        </div>
      ) : null}
    </div>
  );
}
