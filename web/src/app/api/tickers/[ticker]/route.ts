import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchListingExchangeFromYahoo } from "@/lib/yahoo-exchange";

async function persistListingExchange(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  ticker: string,
  exchange: string
) {
  const { data } = await supabase
    .from("symbol_metadata")
    .select("ticker")
    .eq("ticker", ticker)
    .maybeSingle();
  const row = {
    ticker,
    listing_exchange: exchange,
    updated_at: new Date().toISOString(),
  };
  if (data) {
    await supabase.from("symbol_metadata").update(row).eq("ticker", ticker);
  } else {
    await supabase.from("symbol_metadata").insert(row);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const supabase = await createServiceClient();

  const [snapshotResult, barsResult, metaResult] = await Promise.all([
    supabase
      .from("symbol_indicator_snapshot")
      .select("*")
      .eq("ticker", upper)
      .eq("timeframe", "1D")
      .single(),
    supabase
      .from("market_raw_data")
      .select("*")
      .eq("ticker", upper)
      .order("trade_date", { ascending: false })
      .limit(250),
    supabase
      .from("symbol_metadata")
      .select("listing_exchange")
      .eq("ticker", upper)
      .maybeSingle(),
  ]);

  if (snapshotResult.error) {
    return NextResponse.json(
      { error: "Ticker not found" },
      { status: 404 }
    );
  }

  let listing_exchange: string | null = null;
  if (!metaResult.error && metaResult.data) {
    const ex = metaResult.data.listing_exchange;
    if (typeof ex === "string" && ex.trim()) listing_exchange = ex.trim();
  }

  if (!listing_exchange) {
    const y = await fetchListingExchangeFromYahoo(upper);
    if (y) {
      listing_exchange = y;
      try {
        await persistListingExchange(supabase, upper, y);
      } catch {
        /* column missing until migration, or write blocked — chart still works */
      }
    }
  }

  return NextResponse.json({
    snapshot: snapshotResult.data,
    recentBars: barsResult.data ?? [],
    listing_exchange,
  });
}
