"""Repository for all Supabase database operations."""

import logging
from datetime import date, datetime

import pandas as pd
from supabase import Client, create_client

from ..config.settings import RETENTION_BARS, SUPABASE_SERVICE_KEY, SUPABASE_URL
from ..models.snapshot import IndicatorSnapshot

logger = logging.getLogger(__name__)


def _get_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_all_tickers() -> list[str]:
    client = _get_client()
    result = (
        client.table("market_raw_data")
        .select("ticker")
        .execute()
    )
    tickers = sorted(set(row["ticker"] for row in result.data))
    return tickers


def get_ticker_history(ticker: str) -> pd.DataFrame:
    client = _get_client()
    result = (
        client.table("market_raw_data")
        .select("*")
        .eq("ticker", ticker)
        .order("trade_date", desc=False)
        .execute()
    )
    if not result.data:
        return pd.DataFrame()
    df = pd.DataFrame(result.data)
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
        records.append({
            "ticker": ticker,
            "trade_date": row["trade_date"].isoformat()
            if isinstance(row["trade_date"], date)
            else str(row["trade_date"]),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": float(row["volume"]),
            "created_at": now,
        })

    client.table("market_raw_data").upsert(
        records, on_conflict="ticker,trade_date"
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
