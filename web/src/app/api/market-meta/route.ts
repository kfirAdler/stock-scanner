import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServiceClient();

  const [latestUpdateResult, snapshotCountResult] = await Promise.all([
    supabase
      .from("symbol_indicator_snapshot")
      .select("updated_at, last_trade_date")
      .eq("timeframe", "1D")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("symbol_indicator_snapshot")
      .select("ticker", { count: "exact", head: true })
      .eq("timeframe", "1D"),
  ]);

  if (latestUpdateResult.error) {
    return NextResponse.json({ error: latestUpdateResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    lastUpdated: latestUpdateResult.data?.updated_at ?? null,
    lastTradeDate: latestUpdateResult.data?.last_trade_date ?? null,
    snapshotCount: snapshotCountResult.count ?? 0,
  });
}
