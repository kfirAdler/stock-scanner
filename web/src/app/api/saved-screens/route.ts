import { NextRequest, NextResponse } from "next/server";
import { assertScreenerAccess } from "@/lib/market-access";
import { coerceStoredScreen } from "@/lib/screener-query";
import { createClient } from "@/lib/supabase/server";

const SCREEN_NAME_MAX_LENGTH = 80;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeScreenName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name && name.length <= SCREEN_NAME_MAX_LENGTH ? name : null;
}

export async function GET() {
  const gate = await assertScreenerAccess();
  if (!gate.allowed) return gate.response;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("saved_screens")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    screens:
      (data ?? []).map((screen) => ({
        ...screen,
        filter_json: coerceStoredScreen(screen.filter_json),
      })) ?? [],
  });
}

export async function POST(request: NextRequest) {
  const gate = await assertScreenerAccess();
  if (!gate.allowed) return gate.response;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;
  const name = normalizeScreenName(body.name);
  const filter_json = coerceStoredScreen(body.filter_json);

  if (!name || !filter_json) {
    return NextResponse.json({ error: "name and filter_json required" }, { status: 400 });
  }

  if (id) {
    const { error } = await supabase
      .from("saved_screens")
      .update({ name, filter_json, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("saved_screens")
      .insert({ user_id: user.id, name, filter_json });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const gate = await assertScreenerAccess();
  if (!gate.allowed) return gate.response;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Valid screen id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_screens")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Saved screen not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
