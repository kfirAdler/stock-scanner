import { NextRequest, NextResponse } from "next/server";
import { assertScreenerAccess } from "@/lib/market-access";
import { coerceStoredScreen, parseScreenFromSearchParams } from "@/lib/screener-query";
import type {
  ScreenerPayload,
  ScreenerResultRow,
  ScreenerTimeframe,
  SnapshotRow,
} from "@/lib/screener-types";
import { createServiceClient } from "@/lib/supabase/server";

function resultTimeframes(payload: ScreenerPayload) {
  const set = new Set(payload.rules.map((rule) => rule.timeframe));
  set.add("1D");
  return [...set];
}

function groupSnapshotsByTicker(
  rows: SnapshotRow[]
): Record<string, Partial<Record<ScreenerTimeframe, SnapshotRow | null>>> {
  const grouped: Record<string, Partial<Record<ScreenerTimeframe, SnapshotRow | null>>> = {};
  for (const row of rows) {
    const timeframe = row.timeframe as ScreenerTimeframe;
    if (timeframe !== "1D" && timeframe !== "1W" && timeframe !== "1M") continue;
    if (!grouped[row.ticker]) grouped[row.ticker] = {};
    grouped[row.ticker][timeframe] = row;
  }
  return grouped;
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
  const dailyRows = (data ?? []) as ScreenerResultRow[];
  const tickers = dailyRows.map((row) => row.ticker);

  let groupedSnapshots: Record<string, Partial<Record<ScreenerTimeframe, SnapshotRow | null>>> =
    {};
  if (tickers.length > 0) {
    const { data: companionSnapshots, error: companionError } = await supabase
      .from("symbol_indicator_snapshot")
      .select("*")
      .in("ticker", tickers)
      .in("timeframe", ["1W", "1M"]);

    if (companionError) {
      return NextResponse.json({ error: companionError.message }, { status: 500 });
    }

    groupedSnapshots = groupSnapshotsByTicker((companionSnapshots ?? []) as SnapshotRow[]);
  }

  const rows = dailyRows.map((row) => ({
    ...row,
    matched_timeframes,
    timeframe_snapshots: {
      "1D": row,
      "1W": groupedSnapshots[row.ticker]?.["1W"] ?? null,
      "1M": groupedSnapshots[row.ticker]?.["1M"] ?? null,
    },
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
