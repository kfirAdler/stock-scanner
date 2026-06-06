import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServiceClient();

  const [latestSnapshotResult, snapshotCountResult] = await Promise.all([
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

  if (latestSnapshotResult.error) {
    return NextResponse.json({ error: latestSnapshotResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      lastUpdated: latestSnapshotResult.data?.updated_at ?? null,
      lastTradeDate: latestSnapshotResult.data?.last_trade_date ?? null,
      snapshotCount: snapshotCountResult.count ?? 0,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}
