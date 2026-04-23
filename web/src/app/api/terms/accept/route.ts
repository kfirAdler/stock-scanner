import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const termsVersion = body.terms_version ?? "1.0";

  const { error } = await supabase
    .from("user_terms_acceptance")
    .upsert({
      user_id: user.id,
      terms_version: termsVersion,
      accepted_at: new Date().toISOString(),
    }, { onConflict: "user_id,terms_version" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
