import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function parseRequestedPlan(raw: string | null): "premium" | "essential" | "demo" | null {
  if (raw === "premium" || raw === "essential" || raw === "demo") {
    return raw;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const requestedPlan = parseRequestedPlan(searchParams.get("plan"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (requestedPlan) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const service = await createServiceClient();
          await service.from("member_entitlements").upsert(
            {
              user_id: user.id,
              tier: requestedPlan,
              expires_at:
                requestedPlan === "demo"
                  ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                  : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
