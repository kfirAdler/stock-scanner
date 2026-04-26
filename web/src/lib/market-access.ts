import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type MembershipTier = "free" | "premium" | "essential" | "demo";
export type EntitlementStatus = "active" | "inactive" | "expired";

type EntitlementRow = {
  tier?: string | null;
  expires_at?: string | null;
} | null;

export type EntitlementSummary = {
  loggedIn: boolean;
  requiresSubscription: boolean;
  tier: MembershipTier;
  effectiveTier: MembershipTier;
  status: EntitlementStatus;
  expiresAt: string | null;
  canUseScreener: boolean;
  canUseFullMarketData: boolean;
  canUseAlerts: boolean;
};

export type MarketDataGate =
  | { allowed: true }
  | { allowed: false; response: NextResponse };

export function marketDataRequiresSubscription(): boolean {
  return process.env.MARKET_DATA_REQUIRES_SUBSCRIPTION === "true";
}

function normalizeTier(raw: string | null | undefined): MembershipTier {
  if (raw === "premium" || raw === "essential" || raw === "demo") {
    return raw;
  }
  return "free";
}

function isFutureDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts) && ts > Date.now();
}

function buildEntitlementSummary(
  loggedIn: boolean,
  row: EntitlementRow,
  requiresSubscription = marketDataRequiresSubscription()
): EntitlementSummary {
  const tier = normalizeTier(row?.tier);
  const expiresAt = row?.expires_at ?? null;
  const demoActive = tier === "demo" && isFutureDate(expiresAt);
  const effectiveTier: MembershipTier =
    tier === "demo" && !demoActive ? "free" : tier;

  const status: EntitlementStatus =
    tier === "demo"
      ? demoActive
        ? "active"
        : "expired"
      : effectiveTier === "free"
        ? "inactive"
        : "active";

  const canUseScreener =
    !requiresSubscription ||
    effectiveTier === "premium" ||
    effectiveTier === "essential" ||
    effectiveTier === "demo";

  const canUseFullMarketData =
    !requiresSubscription ||
    effectiveTier === "premium" ||
    effectiveTier === "demo";

  const canUseAlerts =
    !requiresSubscription || effectiveTier === "premium" || effectiveTier === "demo";

  return {
    loggedIn,
    requiresSubscription,
    tier,
    effectiveTier,
    status,
    expiresAt,
    canUseScreener,
    canUseFullMarketData,
    canUseAlerts,
  };
}

function loginRequiredResponse(message: string) {
  return NextResponse.json(
    {
      code: "UNAUTHORIZED",
      message,
    },
    { status: 401 }
  );
}

function subscriptionRequiredResponse(message: string) {
  return NextResponse.json(
    {
      code: "SUBSCRIPTION_REQUIRED",
      message,
    },
    { status: 403 }
  );
}

export async function getCurrentEntitlement(): Promise<EntitlementSummary> {
  const requiresSubscription = marketDataRequiresSubscription();
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return buildEntitlementSummary(false, null, requiresSubscription);
  }

  const { data } = await supabase
    .from("member_entitlements")
    .select("tier, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return buildEntitlementSummary(true, data, requiresSubscription);
}

export async function assertScreenerAccess(): Promise<MarketDataGate> {
  if (!marketDataRequiresSubscription()) {
    return { allowed: true };
  }

  const entitlement = await getCurrentEntitlement();
  if (!entitlement.loggedIn) {
    return {
      allowed: false,
      response: loginRequiredResponse(
        "Sign in to access screener filters, saved scans, and market data."
      ),
    };
  }

  if (!entitlement.canUseScreener) {
    return {
      allowed: false,
      response: subscriptionRequiredResponse(
        "Your current plan does not include screener access."
      ),
    };
  }

  return { allowed: true };
}

export async function assertFullMarketDataAccess(): Promise<MarketDataGate> {
  if (!marketDataRequiresSubscription()) {
    return { allowed: true };
  }

  const entitlement = await getCurrentEntitlement();
  if (!entitlement.loggedIn) {
    return {
      allowed: false,
      response: loginRequiredResponse(
        "Sign in to access ticker data, lookups, and market pages."
      ),
    };
  }

  if (!entitlement.canUseFullMarketData) {
    return {
      allowed: false,
      response: subscriptionRequiredResponse(
        "Your current plan does not include full market data access."
      ),
    };
  }

  return { allowed: true };
}
