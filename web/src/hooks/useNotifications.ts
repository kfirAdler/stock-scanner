"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AppNotification {
  id: string;
  kind: "screen_alert" | "market_news";
  title: string;
  body: string;
  source?: string | null;
  url?: string | null;
  tickers?: string[];
  linkLabel?: string | null;
  triggered_at: string;
  seen_at: string | null;
}

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
}

const POLL_INTERVAL_MS = 60_000;

export function useNotifications(active: boolean) {
  const [state, setState] = useState<NotificationsState>({
    notifications: [],
    unreadCount: 0,
    loading: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: AppNotification[];
        unread_count: number;
      };
      setState((prev) => ({
        ...prev,
        notifications: data.notifications,
        unreadCount: data.unread_count,
        loading: false,
      }));
    } catch {
      // Silently ignore network errors.
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    setState((prev) => ({ ...prev, loading: true }));
    void fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, fetchNotifications]);

  const markSeen = useCallback(async (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((notification) =>
        notification.id === id && !notification.seen_at
          ? { ...notification, seen_at: new Date().toISOString() }
          : notification
      ),
      unreadCount: Math.max(
        0,
        prev.unreadCount -
          (prev.notifications.find((notification) => notification.id === id && !notification.seen_at)
            ? 1
            : 0)
      ),
    }));
    try {
      await fetch("/api/notifications/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: prevStateItem(id, state.notifications),
        }),
      });
    } catch {
      // Ignore.
    }
  }, [state.notifications]);

  const markAllSeen = useCallback(async () => {
    const unseenIds = state.notifications
      .filter((notification) => !notification.seen_at)
      .map((notification) => notification.id);
    if (!unseenIds.length) return;
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((notification) => ({
        ...notification,
        seen_at: notification.seen_at ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
    try {
      await fetch("/api/notifications/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: state.notifications
            .filter((notification) => !notification.seen_at)
            .map((notification) => ({
              id: notification.id,
              kind: notification.kind,
            })),
        }),
      });
    } catch {
      // Ignore.
    }
  }, [state.notifications]);

  return { ...state, markSeen, markAllSeen, refetch: fetchNotifications };
}

function prevStateItem(id: string, notifications: AppNotification[]) {
  const item = notifications.find((notification) => notification.id === id);
  return item ? [{ id: item.id, kind: item.kind }] : [{ id, kind: "screen_alert" as const }];
}
