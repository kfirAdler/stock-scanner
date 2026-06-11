import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_NOTIFICATIONS = 30;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("alert_notifications")
    .select("id, saved_screen_id, screen_name, new_tickers, triggered_at, seen_at")
    .eq("user_id", user.id)
    .order("triggered_at", { ascending: false })
    .limit(MAX_NOTIFICATIONS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notifications = data ?? [];
  const unread_count = notifications.filter((notification) => !notification.seen_at).length;

  return NextResponse.json({ notifications, unread_count });
}
