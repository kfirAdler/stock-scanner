"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppNotification } from "@/hooks/useNotifications";

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-accent">
        <BellIcon className="h-5 w-5 text-text-muted" />
      </div>
      <p className="text-sm font-medium text-text">{t("notifications.emptyTitle")}</p>
      <p className="text-xs text-text-secondary">{t("notifications.emptyBody")}</p>
    </div>
  );
}

function NotificationItem({
  notification,
  onSeen,
}: {
  notification: AppNotification;
  onSeen: (id: string) => void;
}) {
  const isUnread = !notification.seen_at;
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    if (!isUnread) return;
    hoverTimerRef.current = setTimeout(() => onSeen(notification.id), 400);
  }

  function handleMouseLeave() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }

  const visibleTickers = notification.new_tickers.slice(0, 7);
  const overflow = notification.new_tickers.length - visibleTickers.length;

  return (
    <div
      className={clsx(
        "group flex gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-[color:var(--color-surface-hover)]",
        isUnread && "bg-[color:var(--color-primary-soft)]/10"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="mt-1.5 flex-shrink-0">
        <div
          className={clsx(
            "h-2 w-2 rounded-full transition-all duration-300",
            isUnread
              ? "bg-[color:var(--color-neon)] shadow-[0_0_6px_var(--color-neon)]"
              : "bg-transparent"
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-semibold leading-tight text-[color:var(--color-text)]">
            {notification.screen_name}
          </span>
          <span className="flex-shrink-0 text-[10px] text-[color:var(--color-text-muted)]">
            {timeAgo(notification.triggered_at)}
          </span>
        </div>

        <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">
          {notification.new_tickers.length === 1
            ? "1 new stock entered"
            : `${notification.new_tickers.length} new stocks entered`}
        </p>

        <div className="mt-2 flex flex-wrap gap-1">
          {visibleTickers.map((ticker) => (
            <span
              key={ticker}
              className="inline-flex items-center rounded-md bg-[color:var(--color-surface-accent)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[color:var(--color-text)]"
            >
              {ticker}
            </span>
          ))}
          {overflow > 0 ? (
            <span className="inline-flex items-center rounded-md bg-[color:var(--color-surface-alt)] px-1.5 py-0.5 text-[10px] text-[color:var(--color-text-muted)]">
              +{overflow} more
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NotificationBell({ loggedIn }: { loggedIn: boolean }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { notifications, unreadCount, loading, markSeen, markAllSeen, refetch } =
    useNotifications(loggedIn);

  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!loggedIn) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          "ui-icon-button relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          open && "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text)]"
        )}
        aria-label={t("notifications.title")}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <BellIcon className="h-5 w-5" />

        {unreadCount > 0 ? (
          <span
            className={clsx(
              "absolute -end-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center",
              "rounded-full bg-[color:var(--color-neon)] px-1 text-[9px] font-bold text-white",
              "ring-2 ring-[color:var(--color-surface-overlay)] transition-all duration-200"
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="ui-panel-strong absolute end-0 z-50 mt-1.5 w-80 overflow-hidden rounded-2xl shadow-xl"
            role="dialog"
            aria-label={t("notifications.title")}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[color:var(--color-text)]">
                  {t("notifications.title")}
                </span>
                {unreadCount > 0 ? (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[color:var(--color-neon-soft)] px-1 text-[9px] font-bold text-[color:var(--color-neon-strong)]">
                    {unreadCount}
                  </span>
                ) : null}
              </div>
              {unreadCount > 0 ? (
                <button
                  onClick={() => void markAllSeen()}
                  className="text-[11px] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text)] focus-visible:outline-none"
                >
                  {t("notifications.markAllSeen")}
                </button>
              ) : null}
            </div>

            <div className="max-h-[420px] divide-y divide-[color:var(--color-divider-soft)] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="flex justify-center py-10">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState t={t} />
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onSeen={markSeen}
                  />
                ))
              )}
            </div>

            {notifications.length > 0 ? (
              <div className="border-t border-[color:var(--color-border)] px-4 py-2.5">
                <p className="text-[10px] text-[color:var(--color-text-muted)]">
                  {t("notifications.hint")}
                </p>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
