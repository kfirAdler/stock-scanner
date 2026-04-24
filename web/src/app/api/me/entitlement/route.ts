import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { marketDataRequiresSubscription } from "@/lib/market-access";

/** Current user subscription tier (for UI). Does not grant API access by itself. */
export async function GET() {
  const requires = marketDataRequiresSubscription();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      loggedIn: false,
      requiresSubscription: requires,
      tier: "free" as const,
    });
  }

  const { data } = await supabase
    .from("member_entitlements")
    .select("tier")
    .eq("user_id", user.id)
    .maybeSingle();

  const tier = data?.tier === "pro" ? "pro" : "free";

  return NextResponse.json({
    loggedIn: true,
    requiresSubscription: requires,
    tier,
  });
}
