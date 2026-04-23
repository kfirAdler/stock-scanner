import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const BOOL_FILTERS = [
  "is_above_sma20", "is_below_sma20",
  "is_above_sma50", "is_below_sma50",
  "is_above_sma150", "is_below_sma150",
  "is_above_sma200", "is_below_sma200",
  "down_sequence_broke_recently", "up_sequence_broke_recently",
  "down_sequence_broke_in_strong_up_context",
] as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const supabase = await createServiceClient();

  let query = supabase
    .from("symbol_indicator_snapshot")
    .select("*")
    .eq("timeframe", "1D");

  for (const key of BOOL_FILTERS) {
    const val = params.get(key);
    if (val === "true") {
      query = query.eq(key, true);
    }
  }

  const pctBbUpper = params.get("pct_to_bb_upper_lte");
  if (pctBbUpper) {
    query = query.lte("pct_to_bb_upper", parseFloat(pctBbUpper));
  }

  const pctBbLower = params.get("pct_to_bb_lower_lte");
  if (pctBbLower) {
    query = query.lte("pct_to_bb_lower", parseFloat(pctBbLower));
  }

  const atrLt = params.get("atr_percent_lt");
  if (atrLt) {
    query = query.lt("atr_percent", parseFloat(atrLt));
  }

  const atrGt = params.get("atr_percent_gt");
  if (atrGt) {
    query = query.gt("atr_percent", parseFloat(atrGt));
  }

  query = query.order("ticker", { ascending: true }).limit(500);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
