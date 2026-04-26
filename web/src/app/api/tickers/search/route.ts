import { NextRequest, NextResponse } from "next/server";
import { assertFullMarketDataAccess } from "@/lib/market-access";
import { createServiceClient } from "@/lib/supabase/server";
import { sanitizeTickerSearchPrefix } from "@/lib/stock-search-coverage";

/**
 * Prefix search for tickers that already have a 1D snapshot.
 * Input is validated to letters, digits, dot, hyphen only — no SQL/LIKE wildcards.
 */
export async function GET(request: NextRequest) {
  const gate = await assertFullMarketDataAccess();
  if (!gate.allowed) return gate.response;

  const raw = request.nextUrl.searchParams.get("q");
  const parsed = sanitizeTickerSearchPrefix(raw);
  if (!parsed.ok) {
    if (parsed.error === "empty") {
      return NextResponse.json({ suggestions: [] });
    }
    return NextResponse.json(
      { error: "Invalid search: use letters, digits, dot, or hyphen only." },
      { status: 400 }
    );
  }

  const { prefix } = parsed;
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("symbol_indicator_snapshot")
    .select("ticker, market, close, last_trade_date")
    .eq("timeframe", "1D")
    .ilike("ticker", `${prefix}%`)
    .order("ticker", { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestions: data ?? [] });
}
