import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_CRON_SECRET ?? "";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");

  if (ADMIN_SECRET && providedSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  const body = await request.json().catch(() => ({}));
  const tickers: string[] | undefined = body.tickers;

  let query = supabase
    .from("symbol_indicator_snapshot")
    .select("ticker, updated_at")
    .eq("timeframe", "1D")
    .order("updated_at", { ascending: true })
    .limit(1);

  const { data: oldest } = await query;
  const lastUpdate = oldest?.[0]?.updated_at ?? "never";

  const countQuery = await supabase
    .from("symbol_indicator_snapshot")
    .select("ticker", { count: "exact", head: true })
    .eq("timeframe", "1D");

  return NextResponse.json({
    status: "ok",
    message:
      "Snapshot recomputation must be triggered via the Python CLI. " +
      "Run: cd services/scanner && source .venv/bin/activate && python3 run_refresh.py",
    snapshot_count: countQuery.count ?? 0,
    oldest_update: lastUpdate,
    help: {
      full_refresh: "python3 run_refresh.py",
      full_refresh_us_only: "python3 run_refresh.py --universe us",
      full_refresh_ta_only: "python3 run_refresh.py --universe ta",
      recompute_only: "python3 recompute_snapshots.py",
      single_ticker: "python3 recompute_snapshots.py --tickers AAPL",
    },
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient();

  const { data: runs, error } = await supabase
    .from("scan_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  const countQuery = await supabase
    .from("symbol_indicator_snapshot")
    .select("ticker", { count: "exact", head: true })
    .eq("timeframe", "1D");

  return NextResponse.json({
    snapshot_count: countQuery.count ?? 0,
    recent_runs: runs ?? [],
  });
}
