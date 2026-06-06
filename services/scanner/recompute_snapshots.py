#!/usr/bin/env python3
"""Recompute all snapshots from existing market_raw_data.

This script does NOT fetch new bars from external APIs.
It reads the historical bars already in the database and computes
indicator snapshots for every ticker.

Default behavior is optimized to use:
1. one Supabase read per ticker (daily history from market_raw_data)
2. one Supabase write per ticker (batched snapshot upsert)

Weekly and monthly bars are derived locally from daily history.
Symbol metadata is not updated here.

Usage:
    python3 recompute_snapshots.py
    python3 recompute_snapshots.py --tickers AAPL MSFT GOOG
"""

import argparse
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("recompute")


def main():
    parser = argparse.ArgumentParser(description="Recompute indicator snapshots")
    parser.add_argument(
        "--tickers", nargs="*",
        help="Specific tickers (default: all in market_raw_data)",
    )
    args = parser.parse_args()

    from src.repositories.market_data_repository import (
        get_all_tickers,
        get_ticker_history_for_timeframe,
        upsert_snapshots,
    )
    from src.indicators.compute import compute_snapshot
    from src.config.settings import SNAPSHOT_TIMEFRAMES
    from src.utils.timeframe_aggregation import aggregate_bars

    if args.tickers:
        tickers = [t.upper() for t in args.tickers]
    else:
        tickers = get_all_tickers()

    total = len(tickers)
    logger.info("Recomputing snapshots for %d tickers", total)

    processed = 0
    failed = 0

    for i, ticker in enumerate(tickers):
        try:
            daily_history = get_ticker_history_for_timeframe(ticker, "1D")
            if daily_history.empty:
                logger.warning("[%d/%d] %s: no history, skipping", i + 1, total, ticker)
                continue

            mk = "TA" if ticker.upper().endswith(".TA") else "US"
            snapshots = []
            for timeframe in SNAPSHOT_TIMEFRAMES:
                history = aggregate_bars(daily_history, timeframe, market=mk)
                snapshot = compute_snapshot(
                    ticker,
                    history,
                    market=mk,
                    timeframe=timeframe,
                )
                if snapshot is None:
                    continue
                snapshots.append(snapshot)
            if not snapshots:
                logger.warning(
                    "[%d/%d] %s: not enough bars (%d), skipping",
                    i + 1,
                    total,
                    ticker,
                    len(daily_history),
                )
                continue
            upsert_snapshots(ticker, snapshots)
            processed += 1

            if processed % 25 == 0 or i == total - 1:
                logger.info(
                    "[%d/%d] Processed %d so far (last: %s)",
                    i + 1,
                    total,
                    processed,
                    ticker,
                )

        except Exception as e:
            failed += 1
            logger.error("[%d/%d] %s failed: %s", i + 1, total, ticker, e)

    logger.info("Done: %d processed, %d failed out of %d total", processed, failed, total)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
