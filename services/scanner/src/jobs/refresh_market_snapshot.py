"""Main orchestration job: refresh market data and recompute snapshots."""

import logging
import time
from datetime import date, datetime, timedelta

import pandas as pd

from ..config.settings import INITIAL_BACKFILL_DAYS, SNAPSHOT_TIMEFRAMES
from ..indicators.compute import compute_snapshot
from ..repositories.market_data_repository import (
    enforce_retention,
    get_latest_bar,
    get_refresh_rows,
    get_ticker_history_for_timeframe,
    log_scan_run,
    upsert_bars,
    upsert_snapshots,
)
from .pattern_snapshots import pattern_input, publish_pattern_snapshots
from .universe import tickers_for_refresh_universe
from ..utils.market_data_fetcher import fetch_bars, reset_provider_circuit
from ..utils.timeframe_aggregation import aggregate_bars

logger = logging.getLogger(__name__)

JOB_NAME = "refresh_market_snapshot"
BATCH_DELAY_SECONDS = 0.5


def _listing_market(ticker: str) -> str:
    return "TA" if ticker.upper().endswith(".TA") else "US"


def changed_bars(bars: pd.DataFrame | None, latest: dict | None) -> pd.DataFrame:
    """Only write new dates or a changed last candle (including its final close)."""
    if bars is None or bars.empty:
        return pd.DataFrame()
    valid = bars.dropna(subset=["open", "high", "low", "close"]).copy()
    valid["volume"] = valid["volume"].fillna(0)
    if latest is None:
        return valid
    last_date = pd.Timestamp(latest["trade_date"]).date()
    def changed(row):
        bar_date = pd.Timestamp(row["trade_date"]).date()
        return bar_date > last_date or (bar_date == last_date and any(
            latest.get(key) is None or float(row[key]) != float(latest[key])
            for key in ("open", "high", "low", "close", "volume")
        ))
    return valid.loc[valid.apply(changed, axis=1)] if not valid.empty else valid


def snapshot_is_current(row: dict | None, latest: dict, date_key: str) -> bool:
    if not row or str(row.get(date_key))[:10] != str(latest["trade_date"])[:10]:
        return False
    # A previous run may have written bars and then failed before publishing.
    # Compare timestamps as well as dates to recover same-day corrections.
    raw_updated = pd.to_datetime(latest.get("created_at"), utc=True)
    snapshot_updated = pd.to_datetime(row.get("updated_at"), utc=True)
    return bool(pd.notna(raw_updated) and pd.notna(snapshot_updated)
                and snapshot_updated >= raw_updated)


def run(
    tickers: list[str] | None = None,
    *,
    universe: str = "all",
    force_recompute: bool = False,
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

    tickers = sorted({ticker.strip().upper() for ticker in tickers if ticker.strip()})
    reset_provider_circuit()
    metadata = {row["ticker"]: row for row in get_refresh_rows(
        "symbol_metadata", "ticker,company_name", tickers)}
    indicators = {(row["ticker"], row["timeframe"]): row for row in get_refresh_rows(
        "symbol_indicator_snapshot", "ticker,timeframe,last_trade_date,updated_at", tickers)}
    patterns = {row["ticker"]: row for row in get_refresh_rows(
        "symbol_pattern_snapshot", "ticker,as_of,updated_at,status", tickers)}
    total = len(tickers)
    skipped = 0
    processed = 0
    failed = 0
    errors: list[str] = []
    pattern_series = []

    today = date.today()

    for ticker in tickers:
        try:
            ticker_started = time.monotonic()
            latest = get_latest_bar(ticker)
            # Re-fetch the most recent date: an intraday candle may need its
            # final close/volume even when today's row already exists.
            start = (pd.Timestamp(latest["trade_date"]).date() if latest
                     else today - timedelta(days=INITIAL_BACKFILL_DAYS))
            fetched = fetch_bars(ticker, start, today) if start <= today else None
            if fetched is None or fetched.empty:
                raise RuntimeError("No price bars returned; keeping existing data for retry")
            new_bars = changed_bars(fetched, latest)
            if not new_bars.empty:
                upsert_bars(ticker, new_bars)
                logger.info("Upserted %d changed bars for %s", len(new_bars), ticker)
                enforce_retention(ticker)

            indicators_current = latest is not None and all(
                snapshot_is_current(indicators.get((ticker, tf)), latest, "last_trade_date")
                for tf in SNAPSHOT_TIMEFRAMES
            )
            pattern_current = (latest is not None
                               and patterns.get(ticker, {}).get("status") != "stale"
                               and snapshot_is_current(patterns.get(ticker), latest, "as_of"))
            if new_bars.empty and indicators_current and pattern_current and not force_recompute:
                skipped += 1
                processed += 1
                logger.info("Unchanged %s; skipped history and writes (%.2fs)",
                            ticker, time.monotonic() - ticker_started)
                time.sleep(BATCH_DELAY_SECONDS)
                continue

            mk = _listing_market(ticker)
            daily_history = get_ticker_history_for_timeframe(ticker, "1D")
            snapshots = []
            for timeframe in SNAPSHOT_TIMEFRAMES:
                history = aggregate_bars(daily_history, timeframe, market=mk)
                snapshot = compute_snapshot(
                    ticker,
                    history,
                    market=mk,
                    timeframe=timeframe,
                )
                if snapshot:
                    snapshots.append(snapshot)
            upsert_snapshots(ticker, snapshots)

            logger.info("Snapshots updated for %s (%.2fs)", ticker,
                        time.monotonic() - ticker_started)
            pattern_series.append(pattern_input(
                ticker, daily_history, metadata.get(ticker, {}).get("company_name")))
            # Publish incrementally so a cancelled run can resume without
            # rebuilding every successfully processed ticker's patterns.
            if len(pattern_series) >= 50:
                batch, pattern_series = pattern_series, []
                publish_pattern_snapshots(batch)
            processed += 1
            time.sleep(BATCH_DELAY_SECONDS)

        except Exception as e:
            failed += 1
            msg = f"{ticker}: {e}"
            errors.append(msg)
            logger.exception("Failed to process %s", ticker)

    pattern_error = None
    try:
        publish_pattern_snapshots(pattern_series)
    except Exception as exc:
        pattern_error = str(exc)
        errors.append(f"Pattern snapshots: {exc}")
        logger.exception("Failed to publish pattern snapshots")

    finished_at = datetime.utcnow()
    status = "completed" if failed == 0 and pattern_error is None else "completed_with_errors"

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
        "skipped_unchanged": skipped,
        "pattern_error": pattern_error,
        "duration_seconds": (finished_at - started_at).total_seconds(),
    }
    logger.info("Job finished: %s", result)
    return result
