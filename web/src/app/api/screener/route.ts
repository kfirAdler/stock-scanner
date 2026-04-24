import { NextRequest, NextResponse } from "next/server";
import { assertMarketDataAccess } from "@/lib/market-access";
import { createServiceClient } from "@/lib/supabase/server";

const BOOL_FILTERS = [
  "is_above_sma20",
  "is_below_sma20",
  "is_above_sma50",
  "is_below_sma50",
  "is_above_sma150",
  "is_below_sma150",
  "is_above_sma200",
  "is_below_sma200",
  "down_sequence_broke_recently",
  "up_sequence_broke_recently",
  "down_sequence_broke_in_strong_up_context",
  "up_sequence_broke_in_strong_down_context",
  "buy_signal",
  "sell_signal",
  "strong_buy_signal",
  "strong_sell_signal",
  "bullish_sequence_active",
  "bearish_sequence_active",
  "strong_up_sequence_context",
  "strong_down_sequence_context",
] as const;

function parseNum(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw === "") return undefined;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? undefined : n;
}

export async function GET(request: NextRequest) {
  const gate = await assertMarketDataAccess();
  if (!gate.allowed) return gate.response;

  const params = request.nextUrl.searchParams;
  const supabase = await createServiceClient();

  let query = supabase
    .from("symbol_indicator_snapshot")
    .select("*")
    .eq("timeframe", "1D");

  const listing = params.get("listing_market");
  if (listing === "US" || listing === "TA") {
    query = query.eq("market", listing);
  }

  for (const key of BOOL_FILTERS) {
    if (params.get(key) === "true") {
      query = query.eq(key, true);
    }
  }

  const pctUpLte = parseNum(params, "pct_to_bb_upper_lte");
  if (pctUpLte !== undefined) query = query.lte("pct_to_bb_upper", pctUpLte);

  const pctLowLte = parseNum(params, "pct_to_bb_lower_lte");
  if (pctLowLte !== undefined) query = query.lte("pct_to_bb_lower", pctLowLte);

  const pctUpGte = parseNum(params, "pct_to_bb_upper_gte");
  if (pctUpGte !== undefined) query = query.gte("pct_to_bb_upper", pctUpGte);

  const pctLowGte = parseNum(params, "pct_to_bb_lower_gte");
  if (pctLowGte !== undefined) query = query.gte("pct_to_bb_lower", pctLowGte);

  const atrPctLt = parseNum(params, "atr_percent_lt");
  if (atrPctLt !== undefined) query = query.lt("atr_percent", atrPctLt);

  const atrPctGt = parseNum(params, "atr_percent_gt");
  if (atrPctGt !== undefined) query = query.gt("atr_percent", atrPctGt);

  const atr14Lt = parseNum(params, "atr_14_lt");
  if (atr14Lt !== undefined) query = query.lt("atr_14", atr14Lt);

  const atr14Gt = parseNum(params, "atr_14_gt");
  if (atr14Gt !== undefined) query = query.gt("atr_14", atr14Gt);

  const closeGte = parseNum(params, "close_gte");
  if (closeGte !== undefined) query = query.gte("close", closeGte);

  const closeLte = parseNum(params, "close_lte");
  if (closeLte !== undefined) query = query.lte("close", closeLte);

  const upCntGte = parseNum(params, "up_sequence_count_gte");
  if (upCntGte !== undefined) query = query.gte("up_sequence_count", upCntGte);

  const downCntGte = parseNum(params, "down_sequence_count_gte");
  if (downCntGte !== undefined) {
    query = query.gte("down_sequence_count", downCntGte);
  }

  const upBreakLte = parseNum(params, "up_sequence_break_bars_ago_lte");
  if (upBreakLte !== undefined) {
    query = query.lte("up_sequence_break_bars_ago", upBreakLte);
  }

  const downBreakLte = parseNum(params, "down_sequence_break_bars_ago_lte");
  if (downBreakLte !== undefined) {
    query = query.lte("down_sequence_break_bars_ago", downBreakLte);
  }

  query = query.order("ticker", { ascending: true }).limit(500);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
