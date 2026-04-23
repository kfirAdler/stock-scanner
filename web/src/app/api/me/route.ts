import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [prefsResult, termsResult] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user_terms_acceptance")
      .select("terms_version, accepted_at")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false })
      .limit(1),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    preferences: prefsResult.data ?? { locale: "en", theme: "system" },
    termsAccepted: (termsResult.data ?? []).length > 0,
    latestTermsVersion: termsResult.data?.[0]?.terms_version ?? null,
  });
}
