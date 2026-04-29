import { NextRequest, NextResponse } from "next/server";
import { assertScreenerAccess } from "@/lib/market-access";
import { coerceStoredScreen, parseScreenFromSearchParams } from "@/lib/screener-query";
import type { ScreenerPayload, ScreenerResultRow } from "@/lib/screener-types";
import { createServiceClient } from "@/lib/supabase/server";

function resultTimeframes(payload: ScreenerPayload) {
  const set = new Set(payload.rules.map((rule) => rule.timeframe));
  set.add("1D");
  return [...set];
}

async function runScreener(payload: ScreenerPayload) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("run_screener_v1", {
    payload,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const matched_timeframes = resultTimeframes(payload);
  const rows = ((data ?? []) as ScreenerResultRow[]).map((row) => ({
    ...row,
    matched_timeframes,
  }));
  return NextResponse.json({ rows, screen: payload });
}

export async function GET(request: NextRequest) {
  const gate = await assertScreenerAccess();
  if (!gate.allowed) return gate.response;

  const payload = parseScreenFromSearchParams(request.nextUrl.searchParams);
  return runScreener(payload);
}

export async function POST(request: NextRequest) {
  const gate = await assertScreenerAccess();
  if (!gate.allowed) return gate.response;

  const body = (await request.json()) as unknown;
  const payload = coerceStoredScreen(body);
  if (!payload) {
    return NextResponse.json({ error: "Invalid screener payload" }, { status: 400 });
  }
  return runScreener(payload);
}
