import { NextRequest, NextResponse } from "next/server";
import { assertScreenerAccess } from "@/lib/market-access";
import { coerceStoredScreen, parseScreenFromSearchParams } from "@/lib/screener-query";
import type {
  ScreenerPayload,
  ScreenerResultsPage,
  ScannerResultSnapshot,
  ScreenerResultRow,
  ScannerSortDir,
  ScannerSortKey,
  ScreenerTimeframe,
} from "@/lib/screener-types";
import { createServiceClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_SORT_KEY: ScannerSortKey = "ticker";
const DEFAULT_SORT_DIR: ScannerSortDir = "asc";
const SNAPSHOT_SELECT = [
  "ticker",
  "timeframe",
  "market",
  "last_trade_date",
  "close",
  "pct_to_bb_upper",
  "pct_to_bb_lower",
  "atr_14",
  "atr_percent",
  "rsi_14",
  "relative_volume_20",
  "is_up_day",
  "bullish_sequence_active",
  "bearish_sequence_active",
  "strong_up_sequence_context",
  "strong_down_sequence_context",
  "up_sequence_count",
  "down_sequence_count",
  "up_sequence_break_bars_ago",
  "down_sequence_break_bars_ago",
  "up_sequence_broke_recently",
  "down_sequence_broke_recently",
  "down_sequence_broke_in_strong_up_context",
  "up_sequence_broke_in_strong_down_context",
  "buy_signal",
  "sell_signal",
  "strong_buy_signal",
  "strong_sell_signal",
  "is_above_sma20",
  "is_below_sma20",
  "is_above_sma50",
  "is_below_sma50",
  "is_above_sma150",
  "is_below_sma150",
  "is_above_sma200",
  "is_below_sma200",
].join(",");

function resultTimeframes(payload: ScreenerPayload) {
  const set = new Set(payload.rules.map((rule) => rule.timeframe));
  set.add("1D");
  return [...set];
}

function groupSnapshotsByTicker(
  rows: ScannerResultSnapshot[]
): Record<string, Partial<Record<ScreenerTimeframe, ScannerResultSnapshot | null>>> {
  const grouped: Record<string, Partial<Record<ScreenerTimeframe, ScannerResultSnapshot | null>>> = {};
  for (const row of rows) {
    const timeframe = row.timeframe as ScreenerTimeframe;
    if (timeframe !== "1D" && timeframe !== "1W" && timeframe !== "1M") continue;
    if (!grouped[row.ticker]) grouped[row.ticker] = {};
    grouped[row.ticker][timeframe] = row;
  }
  return grouped;
}

function parsePositiveInt(
  value: string | number | null | undefined,
  { fallback, min = 0, max }: { fallback: number; min?: number; max?: number }
) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  const normalized = Math.trunc(numeric);
  if (normalized < min) return min;
  if (max != null && normalized > max) return max;
  return normalized;
}

function parseSortKey(value: string | null | undefined): ScannerSortKey {
  return value === "close" || value === "atr_percent" ? value : DEFAULT_SORT_KEY;
}

function parseSortDir(value: string | null | undefined): ScannerSortDir {
  return value === "desc" ? "desc" : DEFAULT_SORT_DIR;
}

async function runScreener(
  payload: ScreenerPayload,
  {
    limit,
    offset,
    sortKey,
    sortDir,
  }: {
    limit: number;
    offset: number;
    sortKey: ScannerSortKey;
    sortDir: ScannerSortDir;
  }
) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("run_screener_v1", {
    payload,
    result_limit: limit + 1,
    result_offset: offset,
    sort_key: sortKey,
    sort_dir: sortDir,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const matched_timeframes = resultTimeframes(payload);
  const rawRows = (data ?? []) as unknown as ScannerResultSnapshot[];
  const hasMore = rawRows.length > limit;
  const dailyRows = rawRows.slice(0, limit) as ScreenerResultRow[];
  const tickers = dailyRows.map((row) => row.ticker);

  let groupedSnapshots: Record<string, Partial<Record<ScreenerTimeframe, ScannerResultSnapshot | null>>> =
    {};
  if (tickers.length > 0) {
    const { data: companionSnapshots, error: companionError } = await supabase
      .from("symbol_indicator_snapshot")
      .select(SNAPSHOT_SELECT)
      .in("ticker", tickers)
      .in("timeframe", ["1W", "1M"])
      .range(0, Math.max(tickers.length * 2 - 1, 0));

    if (companionError) {
      return NextResponse.json({ error: companionError.message }, { status: 500 });
    }

    groupedSnapshots = groupSnapshotsByTicker((companionSnapshots ?? []) as unknown as ScannerResultSnapshot[]);
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
  const response: ScreenerResultsPage = {
    rows,
    screen: payload,
    limit,
    offset,
    hasMore,
    sortKey,
    sortDir,
  };
  return NextResponse.json(response);
}

function requestParamsFromSearch(searchParams: URLSearchParams) {
  return {
    limit: parsePositiveInt(searchParams.get("limit"), { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT }),
    offset: parsePositiveInt(searchParams.get("offset"), { fallback: 0, min: 0 }),
    sortKey: parseSortKey(searchParams.get("sortKey")),
    sortDir: parseSortDir(searchParams.get("sortDir")),
  };
}

export async function GET(request: NextRequest) {
  const gate = await assertScreenerAccess();
  if (!gate.allowed) return gate.response;

  const payload = parseScreenFromSearchParams(request.nextUrl.searchParams);
  return runScreener(payload, requestParamsFromSearch(request.nextUrl.searchParams));
}

export async function POST(request: NextRequest) {
  const gate = await assertScreenerAccess();
  if (!gate.allowed) return gate.response;

  const body = (await request.json()) as
    | unknown
    | {
        screen?: unknown;
        payload?: unknown;
        limit?: number;
        offset?: number;
        sortKey?: string;
        sortDir?: string;
      };
  const requestBody =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as {
          screen?: unknown;
          payload?: unknown;
          limit?: number;
          offset?: number;
          sortKey?: string;
          sortDir?: string;
        })
      : null;
  const bodyPayload = requestBody
    ? (requestBody.screen ?? requestBody.payload ?? requestBody)
    : body;
  const payload = coerceStoredScreen(bodyPayload);
  if (!payload) {
    return NextResponse.json({ error: "Invalid screener payload" }, { status: 400 });
  }
  const params =
    requestBody
      ? {
          limit: parsePositiveInt(requestBody.limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT }),
          offset: parsePositiveInt(requestBody.offset, { fallback: 0, min: 0 }),
          sortKey: parseSortKey(requestBody.sortKey),
          sortDir: parseSortDir(requestBody.sortDir),
        }
      : {
          limit: DEFAULT_LIMIT,
          offset: 0,
          sortKey: DEFAULT_SORT_KEY,
          sortDir: DEFAULT_SORT_DIR,
        };
  return runScreener(payload, params);
}
