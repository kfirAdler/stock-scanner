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
} from "@/lib/screener-types";
import { createServiceClient } from "@/lib/supabase/server";
import { buildDiscoveryEvidence } from "@/lib/discovery-evidence";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_SORT_KEY: ScannerSortKey = "ticker";
const DEFAULT_SORT_DIR: ScannerSortDir = "asc";
function resultTimeframes(payload: ScreenerPayload) {
  const set = new Set(payload.rules.map((rule) => rule.timeframe));
  set.add("1D");
  return [...set];
}

type ScreenerRpcRow = ScannerResultSnapshot & {
  weekly_snapshot?: unknown;
  monthly_snapshot?: unknown;
};

function coerceCompanionSnapshot(value: unknown): ScannerResultSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<ScannerResultSnapshot>;
  if (typeof row.ticker !== "string" || typeof row.timeframe !== "string") return null;
  return row as ScannerResultSnapshot;
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
  return value === "close" || value === "atr_percent" || value === "match_score"
    ? value
    : DEFAULT_SORT_KEY;
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
  const rawRows = (data ?? []) as unknown as ScreenerRpcRow[];
  const hasMore = rawRows.length > limit;
  const rows: ScreenerResultRow[] = rawRows.slice(0, limit).map((row) => {
    const { weekly_snapshot, monthly_snapshot, ...dailyRow } = row;
    const resultRow: ScreenerResultRow = {
      ...dailyRow,
      matched_timeframes,
      timeframe_snapshots: {
        "1D": dailyRow,
        "1W": coerceCompanionSnapshot(weekly_snapshot),
        "1M": coerceCompanionSnapshot(monthly_snapshot),
      },
    };
    return {
      ...resultRow,
      ...buildDiscoveryEvidence(payload.discovery_goal, resultRow),
    };
  });
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
