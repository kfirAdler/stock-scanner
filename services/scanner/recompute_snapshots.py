#!/usr/bin/env python3
"""Recompute all snapshots from existing market_raw_data.

This script does NOT fetch new bars from external APIs.
It reads the historical bars already in the database and computes
indicator snapshots for every ticker.

Usage:
    python3 recompute_snapshots.py
    python3 recompute_snapshots.py --tickers AAPL MSFT GOOG
"""

import argparse
import logging
import sys
import time

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
        get_ticker_history,
        upsert_snapshot,
        upsert_symbol_metadata,
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
            history = get_ticker_history(ticker)
            if history.empty:
                logger.warning("[%d/%d] %s: no history, skipping", i + 1, total, ticker)
                continue

            mk = "TA" if ticker.upper().endswith(".TA") else "US"
            wrote_any = False
            for timeframe in SNAPSHOT_TIMEFRAMES:
                aggregated = aggregate_bars(history, timeframe, market=mk)
                snapshot = compute_snapshot(
                    ticker,
                    aggregated,
                    market=mk,
                    timeframe=timeframe,
                )
                if snapshot is None:
                    continue
                upsert_snapshot(snapshot)
                wrote_any = True
            if not wrote_any:
                logger.warning(
                    "[%d/%d] %s: not enough bars (%d), skipping",
                    i + 1,
                    total,
                    ticker,
                    len(history),
                )
                continue
            upsert_symbol_metadata(
                ticker,
                market=mk,
                listing_exchange="TASE" if mk == "TA" else None,
            )
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
