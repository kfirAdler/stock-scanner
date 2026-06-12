import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_NOTIFICATIONS = 30;

type ScanAlertNotification = {
  id: string;
  kind: "screen_alert";
  title: string;
  body: string;
  triggered_at: string;
  seen_at: string | null;
  source?: string | null;
  url?: string | null;
  tickers?: string[];
};

type GlobalNewsNotification = {
  id: string;
  kind: "market_news";
  title: string;
  body: string;
  triggered_at: string;
  seen_at: string | null;
  source?: string | null;
  url?: string | null;
  tickers?: string[];
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: alertData, error: alertError }, { data: globalData, error: globalError }] =
    await Promise.all([
      supabase
        .from("alert_notifications")
        .select("id, saved_screen_id, screen_name, new_tickers, triggered_at, seen_at")
        .eq("user_id", user.id)
        .order("triggered_at", { ascending: false })
        .limit(MAX_NOTIFICATIONS),
      supabase
        .from("global_market_notifications")
        .select("id, headline, source, url, published_at, expires_at, slot")
        .gt("expires_at", new Date().toISOString())
        .order("published_at", { ascending: false })
        .order("slot", { ascending: true })
        .limit(MAX_NOTIFICATIONS),
    ]);

  if (alertError) return NextResponse.json({ error: alertError.message }, { status: 500 });
  if (globalError) return NextResponse.json({ error: globalError.message }, { status: 500 });

  const globalIds = (globalData ?? []).map((item) => item.id);
  const { data: readData, error: readError } = globalIds.length
    ? await supabase
        .from("user_global_notification_reads")
        .select("notification_id, seen_at")
        .eq("user_id", user.id)
        .in("notification_id", globalIds)
    : { data: [], error: null };
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const globalReads = new Map(
    (readData ?? []).map((row) => [row.notification_id as string, row.seen_at as string | null])
  );

  const scanNotifications: ScanAlertNotification[] = (alertData ?? []).map((item) => ({
    id: item.id,
    kind: "screen_alert",
    title: item.screen_name,
    body:
      item.new_tickers.length === 1
        ? "1 new stock entered"
        : `${item.new_tickers.length} new stocks entered`,
    triggered_at: item.triggered_at,
    seen_at: item.seen_at,
    tickers: item.new_tickers,
  }));

  const globalNotifications: GlobalNewsNotification[] = (globalData ?? []).map((item) => ({
    id: item.id,
    kind: "market_news",
    title: item.headline,
    body: item.source ? `Top market headline · ${item.source}` : "Top market headline",
    triggered_at: item.published_at,
    seen_at: globalReads.get(item.id) ?? null,
    source: item.source,
    url: item.url,
    linkLabel: item.source ? `Source: ${item.source}` : "Open article",
  }));

  const notifications = [...scanNotifications, ...globalNotifications]
    .sort(
      (a, b) =>
        new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
    )
    .slice(0, MAX_NOTIFICATIONS);
  const unread_count = notifications.filter((notification) => !notification.seen_at).length;

  return NextResponse.json({ notifications, unread_count });
}
