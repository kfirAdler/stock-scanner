import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const supabase = await createServiceClient();

  const [snapshotResult, barsResult] = await Promise.all([
    supabase
      .from("symbol_indicator_snapshot")
      .select("*")
      .eq("ticker", ticker.toUpperCase())
      .eq("timeframe", "1D")
      .single(),
    supabase
      .from("market_raw_data")
      .select("*")
      .eq("ticker", ticker.toUpperCase())
      .order("trade_date", { ascending: false })
      .limit(250),
  ]);

  if (snapshotResult.error) {
    return NextResponse.json(
      { error: "Ticker not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    snapshot: snapshotResult.data,
    recentBars: barsResult.data ?? [],
  });
}
