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
const SECTOR_SUMMARY_LIMIT = 2000;
const METADATA_BATCH_SIZE = 200;
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

type ScreenerMetadataRow = {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
};

function normalizeMetadataText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadMetadata(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  tickers: string[]
) {
  const uniqueTickers = [...new Set(tickers)];
  const batches: string[][] = [];
  for (let index = 0; index < uniqueTickers.length; index += METADATA_BATCH_SIZE) {
    batches.push(uniqueTickers.slice(index, index + METADATA_BATCH_SIZE));
  }

  const responses = await Promise.all(
    batches.map((batch) =>
      supabase
        .from("symbol_metadata")
        .select("ticker,company_name,sector,industry")
        .in("ticker", batch)
    )
  );

  const rows: ScreenerMetadataRow[] = [];
  for (const response of responses) {
    if (response.error) continue;
    for (const item of response.data ?? []) {
      if (typeof item.ticker !== "string") continue;
      rows.push({
        ticker: item.ticker,
        company_name: normalizeMetadataText(item.company_name),
        sector: normalizeMetadataText(item.sector),
        industry: normalizeMetadataText(item.industry),
      });
    }
  }
  return rows;
}

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
  const pageRequest = supabase.rpc("run_screener_v1", {
    payload,
    result_limit: limit + 1,
    result_offset: offset,
    sort_key: sortKey,
    sort_dir: sortDir,
  });
  const summaryRequest =
    offset === 0
      ? supabase
          .rpc("run_screener_v1", {
            payload,
            result_limit: SECTOR_SUMMARY_LIMIT,
            result_offset: 0,
            sort_key: "ticker",
            sort_dir: "asc",
          })
          .select("ticker")
      : Promise.resolve({ data: null, error: null });
  const [{ data, error }, summaryResult] = await Promise.all([
    pageRequest,
    summaryRequest,
  ]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const matched_timeframes = resultTimeframes(payload);
  const rawRows = (data ?? []) as unknown as ScreenerRpcRow[];
  const hasMore = rawRows.length > limit;
  const pageRows = rawRows.slice(0, limit);
  const summaryRows =
    offset === 0 && !summaryResult.error && Array.isArray(summaryResult.data)
      ? summaryResult.data
      : null;
  const hasCompleteSummary = summaryRows !== null;
  const summaryTickers =
    summaryRows !== null
      ? summaryRows
          .map((row) => (row && typeof row.ticker === "string" ? row.ticker : null))
          .filter((ticker): ticker is string => ticker !== null)
      : pageRows.map((row) => row.ticker);
  const metadataRows = await loadMetadata(supabase, [
    ...summaryTickers,
    ...pageRows.map((row) => row.ticker),
  ]);
  const metadataByTicker = new Map(metadataRows.map((row) => [row.ticker, row]));
  const rows: ScreenerResultRow[] = pageRows.map((row) => {
    const { weekly_snapshot, monthly_snapshot, ...dailyRow } = row;
    const metadata = metadataByTicker.get(row.ticker);
    const resultRow: ScreenerResultRow = {
      ...dailyRow,
      company_name: metadata?.company_name ?? null,
      sector: metadata?.sector ?? null,
      industry: metadata?.industry ?? null,
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

  const sectorCounts = new Map<string | null, number>();
  for (const ticker of summaryTickers) {
    const sector = metadataByTicker.get(ticker)?.sector ?? null;
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
  }
  const sectorBreakdown = [...sectorCounts.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count || (a.sector ?? "").localeCompare(b.sector ?? ""));
  const response: ScreenerResultsPage = {
    rows,
    ...(hasCompleteSummary
      ? {
          totalCount: summaryTickers.length,
          sectorBreakdown,
        }
      : {}),
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
