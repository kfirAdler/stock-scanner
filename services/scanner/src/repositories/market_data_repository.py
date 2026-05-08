"""Repository for all Supabase database operations."""

import logging
from datetime import date, datetime
from functools import lru_cache

import pandas as pd
from supabase import Client, create_client

from ..config.settings import RETENTION_BARS, SUPABASE_SERVICE_KEY, SUPABASE_URL
from ..models.snapshot import IndicatorSnapshot

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_client() -> Client:
    # Reuse a single Supabase/httpx client per process to avoid exhausting file
    # descriptors during long backfill/recompute runs.
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_all_tickers() -> list[str]:
    client = _get_client()
    page_size = 1000

    def _fetch_tickers(table: str, *, timeframe: str | None = None) -> list[str]:
        tickers: set[str] = set()
        offset = 0
        while True:
            query = client.table(table).select("ticker").order("ticker")
            if timeframe is not None:
                query = query.eq("timeframe", timeframe)
            result = query.range(offset, offset + page_size - 1).execute()
            if not result.data:
                break
            for row in result.data:
                ticker = row.get("ticker")
                if isinstance(ticker, str) and ticker.strip():
                    tickers.add(ticker)
            if len(result.data) < page_size:
                break
            offset += page_size
        return sorted(tickers)

    tickers = _fetch_tickers("symbol_metadata")
    if tickers:
        return tickers
    return _fetch_tickers("symbol_indicator_snapshot", timeframe="1D")


def get_ticker_history(ticker: str) -> pd.DataFrame:
    client = _get_client()
    all_rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        result = (
            client.table("market_raw_data")
            .select("trade_date,open,high,low,close,volume")
            .eq("ticker", ticker)
            .order("trade_date", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not result.data:
            break
        all_rows.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size
    if not all_rows:
        return pd.DataFrame()
    df = pd.DataFrame(all_rows)
    df["trade_date"] = pd.to_datetime(df["trade_date"]).dt.date
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def get_ticker_history_for_timeframe(ticker: str, timeframe: str) -> pd.DataFrame:
    if timeframe == "1D":
        return get_ticker_history(ticker)

    if timeframe == "1W":
        table = "market_weekly_data"
        date_column = "last_trade_date"
    elif timeframe == "1M":
        table = "market_monthly_data"
        date_column = "last_trade_date"
    else:
        raise ValueError(f"Unsupported timeframe: {timeframe}")

    client = _get_client()
    all_rows: list[dict] = []
    page_size = 1000
    offset = 0
    select_columns = f"{date_column},open,high,low,close,volume"

    while True:
        result = (
            client.table(table)
            .select(select_columns)
            .eq("ticker", ticker)
            .order(date_column, desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not result.data:
            break
        all_rows.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    if not all_rows:
        return pd.DataFrame()

    df = pd.DataFrame(all_rows).rename(columns={date_column: "trade_date"})
    df["trade_date"] = pd.to_datetime(df["trade_date"]).dt.date
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def get_latest_trade_date(ticker: str) -> date | None:
    client = _get_client()
    result = (
        client.table("market_raw_data")
        .select("trade_date")
        .eq("ticker", ticker)
        .order("trade_date", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return pd.to_datetime(result.data[0]["trade_date"]).date()
    return None


def upsert_bars(ticker: str, df: pd.DataFrame) -> int:
    if df.empty:
        return 0

    client = _get_client()
    records = []
    now = datetime.utcnow().isoformat()
    for _, row in df.iterrows():
        o, h, l, c, v = (
            row["open"],
            row["high"],
            row["low"],
            row["close"],
            row["volume"],
        )
        if any(pd.isna(x) for x in (o, h, l, c)):
            continue
        if pd.isna(v):
            v = 0.0
        records.append({
            "ticker": ticker,
            "trade_date": row["trade_date"].isoformat()
            if isinstance(row["trade_date"], date)
            else str(row["trade_date"]),
            "open": float(o),
            "high": float(h),
            "low": float(l),
            "close": float(c),
            "volume": float(v),
            "created_at": now,
        })

    if not records:
        return 0

    # Avoid oversized single requests on first-time backfills (hundreds of rows per ticker).
    chunk_size = 400
    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        client.table("market_raw_data").upsert(
            chunk, on_conflict="ticker,trade_date"
        ).execute()
    return len(records)


def enforce_retention(ticker: str, keep: int = RETENTION_BARS) -> int:
    client = _get_client()
    result = (
        client.table("market_raw_data")
        .select("trade_date")
        .eq("ticker", ticker)
        .order("trade_date", desc=True)
        .execute()
    )
    if not result.data or len(result.data) <= keep:
        return 0

    cutoff_date = result.data[keep - 1]["trade_date"]
    client.table("market_raw_data").delete().eq("ticker", ticker).lt(
        "trade_date", cutoff_date
    ).execute()

    deleted = len(result.data) - keep
    logger.info("Retention: removed %d old bars for %s", deleted, ticker)
    return deleted


def upsert_snapshot(snapshot: IndicatorSnapshot) -> None:
    client = _get_client()
    data = snapshot.to_dict()
    client.table("symbol_indicator_snapshot").upsert(
        data, on_conflict="ticker,timeframe"
    ).execute()


def get_listing_exchange(ticker: str) -> str | None:
    client = _get_client()
    result = (
        client.table("symbol_metadata")
        .select("listing_exchange")
        .eq("ticker", ticker)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    ex = result.data[0].get("listing_exchange")
    return ex if isinstance(ex, str) and ex.strip() else None


def upsert_symbol_market(ticker: str, market: str) -> None:
    client = _get_client()
    now = datetime.utcnow().isoformat()
    existing = (
        client.table("symbol_metadata")
        .select("ticker")
        .eq("ticker", ticker)
        .limit(1)
        .execute()
    )
    if existing.data:
        client.table("symbol_metadata").update({
            "market": market,
            "updated_at": now,
        }).eq("ticker", ticker).execute()
    else:
        client.table("symbol_metadata").insert({
            "ticker": ticker,
            "market": market,
            "updated_at": now,
        }).execute()


def persist_listing_exchange(ticker: str, exchange: str) -> None:
    client = _get_client()
    existing = (
        client.table("symbol_metadata")
        .select("ticker")
        .eq("ticker", ticker)
        .limit(1)
        .execute()
    )
    row = {"ticker": ticker, "listing_exchange": exchange}
    if existing.data:
        client.table("symbol_metadata").update(row).eq("ticker", ticker).execute()
    else:
        client.table("symbol_metadata").insert(row).execute()


def upsert_symbol_metadata(
    ticker: str,
    *,
    market: str,
    listing_exchange: str | None = None,
    market_cap: float | None = None,
) -> None:
    client = _get_client()
    now = datetime.utcnow().isoformat()
    row: dict[str, object] = {
        "ticker": ticker,
        "market": market,
        "updated_at": now,
    }
    if listing_exchange is not None:
        row["listing_exchange"] = listing_exchange
    if market_cap is not None:
        row["market_cap"] = market_cap
    existing = (
        client.table("symbol_metadata")
        .select("ticker")
        .eq("ticker", ticker)
        .limit(1)
        .execute()
    )
    if existing.data:
        client.table("symbol_metadata").update(row).eq("ticker", ticker).execute()
    else:
        client.table("symbol_metadata").insert(row).execute()


def log_scan_run(
    job_name: str,
    timeframe: str,
    status: str,
    started_at: datetime,
    finished_at: datetime | None = None,
    total_symbols: int | None = None,
    processed_symbols: int | None = None,
    failed_symbols: int | None = None,
    error_message: str | None = None,
) -> None:
    client = _get_client()
    record = {
        "job_name": job_name,
        "timeframe": timeframe,
        "status": status,
        "started_at": started_at.isoformat(),
    }
    if finished_at:
        record["finished_at"] = finished_at.isoformat()
    if total_symbols is not None:
        record["total_symbols"] = total_symbols
    if processed_symbols is not None:
        record["processed_symbols"] = processed_symbols
    if failed_symbols is not None:
        record["failed_symbols"] = failed_symbols
    if error_message:
        record["error_message"] = error_message

    client.table("scan_runs").insert(record).execute()
