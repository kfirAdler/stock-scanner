import { NextRequest, NextResponse } from "next/server";
import { assertAlertsAccess } from "@/lib/market-access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const gate = await assertAlertsAccess();
  if (!gate.allowed) return gate.response;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("screen_alerts")
    .select("id, saved_screen_id, enabled, last_checked_at")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const gate = await assertAlertsAccess();
  if (!gate.allowed) return gate.response;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { saved_screen_id?: string; enabled?: boolean };
  const { saved_screen_id, enabled } = body;

  if (!saved_screen_id || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "saved_screen_id and enabled required" },
      { status: 400 }
    );
  }

  const { data: screen } = await supabase
    .from("saved_screens")
    .select("id")
    .eq("id", saved_screen_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("screen_alerts")
    .upsert(
      {
        user_id: user.id,
        saved_screen_id,
        enabled,
        last_tickers: enabled ? null : undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,saved_screen_id", ignoreDuplicates: false }
    )
    .select("id, saved_screen_id, enabled, last_checked_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ alert: data });
}
