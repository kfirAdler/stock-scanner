"""Main orchestration job: refresh market data and recompute snapshots."""

import logging
import time
from datetime import date, datetime, timedelta

from ..config.settings import TIMEFRAME
from ..indicators.compute import compute_snapshot
from ..repositories.market_data_repository import (
    enforce_retention,
    get_all_tickers,
    get_latest_trade_date,
    get_listing_exchange,
    get_ticker_history,
    log_scan_run,
    persist_listing_exchange,
    upsert_bars,
    upsert_snapshot,
)
from ..utils.listing_exchange import fetch_listing_exchange_yfinance
from ..utils.market_data_fetcher import fetch_bars

logger = logging.getLogger(__name__)

JOB_NAME = "refresh_market_snapshot"
BATCH_DELAY_SECONDS = 0.5


def run(tickers: list[str] | None = None) -> dict:
    started_at = datetime.utcnow()
    logger.info("Starting %s at %s", JOB_NAME, started_at.isoformat())

    log_scan_run(
        job_name=JOB_NAME,
        timeframe=TIMEFRAME,
        status="running",
        started_at=started_at,
    )

    if tickers is None:
        tickers = get_all_tickers()

    total = len(tickers)
    processed = 0
    failed = 0
    errors: list[str] = []

    today = date.today()

    for ticker in tickers:
        try:
            latest = get_latest_trade_date(ticker)
            start = (latest + timedelta(days=1)) if latest else (today - timedelta(days=900))

            if start <= today:
                new_bars = fetch_bars(ticker, start, today)
                if new_bars is not None and not new_bars.empty:
                    upsert_bars(ticker, new_bars)
                    logger.info("Upserted %d new bars for %s", len(new_bars), ticker)

                enforce_retention(ticker)

            history = get_ticker_history(ticker)
            snapshot = compute_snapshot(ticker, history)
            if snapshot:
                upsert_snapshot(snapshot)
                logger.info("Snapshot updated for %s", ticker)
                if not get_listing_exchange(ticker):
                    tv_ex = fetch_listing_exchange_yfinance(ticker)
                    if tv_ex:
                        persist_listing_exchange(ticker, tv_ex)

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
        timeframe=TIMEFRAME,
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
