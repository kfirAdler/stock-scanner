"""Main orchestration job: refresh market data and recompute snapshots."""

import logging
import time
from datetime import date, datetime, timedelta

from ..config.settings import INITIAL_BACKFILL_DAYS, SNAPSHOT_TIMEFRAMES
from ..indicators.compute import compute_snapshot
from ..repositories.market_data_repository import (
    enforce_retention,
    get_latest_trade_date,
    get_ticker_history,
    log_scan_run,
    upsert_bars,
    upsert_snapshot,
    upsert_symbol_metadata,
)
from .universe import tickers_for_refresh_universe
from ..utils.market_data_fetcher import fetch_bars
from ..utils.symbol_metadata import fetch_symbol_metadata_yfinance
from ..utils.timeframe_aggregation import aggregate_bars

logger = logging.getLogger(__name__)

JOB_NAME = "refresh_market_snapshot"
BATCH_DELAY_SECONDS = 0.5


def _listing_market(ticker: str) -> str:
    return "TA" if ticker.upper().endswith(".TA") else "US"


def run(
    tickers: list[str] | None = None,
    *,
    universe: str = "all",
) -> dict:
    started_at = datetime.utcnow()
    logger.info("Starting %s at %s", JOB_NAME, started_at.isoformat())

    log_scan_run(
        job_name=JOB_NAME,
        timeframe="ALL",
        status="running",
        started_at=started_at,
    )

    if tickers is None:
        tickers = tickers_for_refresh_universe(universe)

    total = len(tickers)
    processed = 0
    failed = 0
    errors: list[str] = []

    today = date.today()

    for ticker in tickers:
        try:
            latest = get_latest_trade_date(ticker)
            start = (
                latest + timedelta(days=1)
                if latest
                else (today - timedelta(days=INITIAL_BACKFILL_DAYS))
            )

            if start <= today:
                new_bars = fetch_bars(ticker, start, today)
                if new_bars is not None and not new_bars.empty:
                    upsert_bars(ticker, new_bars)
                    logger.info("Upserted %d new bars for %s", len(new_bars), ticker)
                elif latest is None:
                    logger.warning(
                        "No OHLC from data providers for %s (requested from %s); "
                        "check symbol on Yahoo Finance or Stooq API access",
                        ticker,
                        start,
                    )

                enforce_retention(ticker)

            history = get_ticker_history(ticker)
            mk = _listing_market(ticker)
            for timeframe in SNAPSHOT_TIMEFRAMES:
                aggregated = aggregate_bars(history, timeframe, market=mk)
                snapshot = compute_snapshot(
                    ticker,
                    aggregated,
                    market=mk,
                    timeframe=timeframe,
                )
                if snapshot:
                    upsert_snapshot(snapshot)

            metadata = fetch_symbol_metadata_yfinance(ticker)
            listing_exchange = "TASE" if mk == "TA" else metadata.get("listing_exchange")
            upsert_symbol_metadata(
                ticker,
                market=mk,
                listing_exchange=listing_exchange,
                market_cap=metadata.get("market_cap"),
            )
            logger.info("Snapshots updated for %s", ticker)

            processed += 1
            time.sleep(BATCH_DELAY_SECONDS)

        except Exception as e:
            failed += 1
            msg = f"{ticker}: {e}"
            errors.append(msg)
            logger.exception("Failed to process %s", ticker)

    finished_at = datetime.utcnow()
    status = "completed" if failed == 0 else "completed_with_errors"

    log_scan_run(
        job_name=JOB_NAME,
        timeframe="ALL",
        status=status,
        started_at=started_at,
        finished_at=finished_at,
        total_symbols=total,
        processed_symbols=processed,
        failed_symbols=failed,
        error_message="\n".join(errors[:20]) if errors else None,
    )

    result = {
        "status": status,
        "total": total,
        "processed": processed,
        "failed": failed,
        "duration_seconds": (finished_at - started_at).total_seconds(),
    }
    logger.info("Job finished: %s", result)
    return result
