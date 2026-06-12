import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SeenItem = {
  id: string;
  kind?: "screen_alert" | "market_news";
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { ids?: string[]; items?: SeenItem[] };
  const ids = body?.ids;
  const items = body?.items;

  const normalizedItems: SeenItem[] = Array.isArray(items)
    ? items.filter(
        (item): item is SeenItem =>
          !!item && typeof item.id === "string" && item.id.length > 0
      )
    : Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string" && id.length > 0).map((id) => ({
          id,
          kind: "screen_alert",
        }))
      : [];

  if (!normalizedItems.length) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  const scanIds = normalizedItems
    .filter((item) => item.kind !== "market_news")
    .map((item) => item.id);
  const marketNewsIds = normalizedItems
    .filter((item) => item.kind === "market_news")
    .map((item) => item.id);

  let updated = 0;

  if (scanIds.length) {
    const { error, count } = await supabase
      .from("alert_notifications")
      .update({ seen_at: new Date().toISOString() }, { count: "exact" })
      .eq("user_id", user.id)
      .is("seen_at", null)
      .in("id", scanIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += count ?? 0;
  }

  if (marketNewsIds.length) {
    const rows = marketNewsIds.map((id) => ({
      user_id: user.id,
      notification_id: id,
      seen_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("user_global_notification_reads")
      .upsert(rows, { onConflict: "user_id,notification_id", ignoreDuplicates: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += marketNewsIds.length;
  }

  return NextResponse.json({ updated });
}
