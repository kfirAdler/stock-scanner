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
MAX_UNAVAILABLE_RATIO = 0.10


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
    total = len(tickers)
    skipped = 0
    skipped_unavailable = 0
    processed = 0
    failed = 0
    errors: list[str] = []
    pattern_series = []
    pattern_failed = 0
    pattern_updated = 0
    daily_histories: dict[str, pd.DataFrame] = {}

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
                if latest is not None:
                    skipped_unavailable += 1
                    processed += 1
                    time.sleep(BATCH_DELAY_SECONDS)
                    continue
                raise RuntimeError("No price bars returned; no stored data available")
            new_bars = changed_bars(fetched, latest)
            if not new_bars.empty:
                upsert_bars(ticker, new_bars)
                logger.info("Upserted %d changed bars for %s", len(new_bars), ticker)
                enforce_retention(ticker)

            indicators_current = latest is not None and all(
                snapshot_is_current(indicators.get((ticker, tf)), latest, "last_trade_date")
                for tf in SNAPSHOT_TIMEFRAMES
            )
            if new_bars.empty and indicators_current and not force_recompute:
                skipped += 1
                processed += 1
                logger.info("Unchanged %s; skipped history and writes (%.2fs)",
                            ticker, time.monotonic() - ticker_started)
                time.sleep(BATCH_DELAY_SECONDS)
                continue

            mk = _listing_market(ticker)
            daily_history = get_ticker_history_for_timeframe(ticker, "1D")
            daily_histories[ticker] = daily_history
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
            processed += 1
            time.sleep(BATCH_DELAY_SECONDS)

        except Exception as e:
            failed += 1
            msg = f"{ticker}: {e}"
            errors.append(msg)
            # A bad/delisted symbol must not fail the complete scheduled job.
            # Individual failures are included only in the final summary.

    def publish_patterns_best_effort(batch: list[dict]) -> None:
        """Publish all valid patterns, isolating a bad symbol without aborting."""
        nonlocal pattern_failed, pattern_updated
        if not batch:
            return
        try:
            pattern_updated += publish_pattern_snapshots(batch)
        except Exception as exc:
            if len(batch) > 1:
                midpoint = len(batch) // 2
                publish_patterns_best_effort(batch[:midpoint])
                publish_patterns_best_effort(batch[midpoint:])
            else:
                pattern_failed += 1
                errors.append(f"{batch[0]['ticker']} pattern: {exc}")

    # Patterns are intentionally a separate pass. They must be refreshed for
    # every symbol even when prices were unchanged, unavailable, or indicator
    # processing failed above.
    for ticker in tickers:
        try:
            daily_history = daily_histories.get(ticker)
            if daily_history is None:
                daily_history = get_ticker_history_for_timeframe(ticker, "1D")
            pattern_series.append(pattern_input(
                ticker, daily_history, metadata.get(ticker, {}).get("company_name")))
            if len(pattern_series) >= 50:
                batch, pattern_series = pattern_series, []
                publish_patterns_best_effort(batch)
        except Exception as exc:
            pattern_failed += 1
            errors.append(f"{ticker} pattern: {exc}")

    publish_patterns_best_effort(pattern_series)

    provider_error = None
    unavailable_ratio = skipped_unavailable / total if total else 0
    if unavailable_ratio > MAX_UNAVAILABLE_RATIO:
        provider_error = (
            f"Price providers returned no data for {skipped_unavailable}/{total} symbols "
            f"({unavailable_ratio:.1%}); possible provider-wide outage"
        )
        errors.append(provider_error)

    finished_at = datetime.utcnow()
    # Per-symbol/provider failures are non-fatal for this best-effort refresh.
    # Unexpected errors outside these guarded sections still fail the process.
    status = "completed"

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
        "skipped_unavailable": skipped_unavailable,
        "patterns_updated": pattern_updated,
        "patterns_failed": pattern_failed,
        "provider_error": provider_error,
        "warnings": errors[:20],
        "duration_seconds": (finished_at - started_at).total_seconds(),
    }
    logger.info(
        "Job finished: status=%s total=%d processed=%d stock_failures=%d "
        "unavailable=%d patterns_updated=%d pattern_failures=%d warnings=%d",
        status, total, processed, failed, skipped_unavailable,
        pattern_updated, pattern_failed, len(errors),
    )
    return result
