import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** When true, market APIs require a signed-in user with member_entitlements.tier = 'pro'. */
export function marketDataRequiresSubscription(): boolean {
  return process.env.MARKET_DATA_REQUIRES_SUBSCRIPTION === "true";
}

export type MarketDataGate =
  | { allowed: true }
  | { allowed: false; response: NextResponse };

/**
 * Enforces login + Pro tier when MARKET_DATA_REQUIRES_SUBSCRIPTION=true.
 * Uses the user session cookie (no service role) to read member_entitlements under RLS.
 */
export async function assertMarketDataAccess(): Promise<MarketDataGate> {
  if (!marketDataRequiresSubscription()) {
    return { allowed: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "Sign in to access market data and the screener.",
        },
        { status: 401 }
      ),
    };
  }

  const { data, error } = await supabase
    .from("member_entitlements")
    .select("tier")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      allowed: false,
      response: NextResponse.json(
        { code: "ENTITLEMENT_ERROR", message: error.message },
        { status: 500 }
      ),
    };
  }

  const tier = data?.tier ?? "free";
  if (tier !== "pro") {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          code: "SUBSCRIPTION_REQUIRED",
          message:
            "An active membership is required to view scans, filters, and ticker data.",
        },
        { status: 403 }
      ),
    };
  }

  return { allowed: true };
}
