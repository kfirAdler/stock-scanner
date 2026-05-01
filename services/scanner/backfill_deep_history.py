#!/usr/bin/env python3
"""Backfill deep daily history, then recompute 1D/1W/1M snapshots.

This script is resumable. For each ticker that already has a 1D snapshot, it:
1. Checks the earliest stored daily bar in market_raw_data.
2. Fetches only the missing older bars needed to reach the configured backfill depth.
3. Enforces retention.
4. Recomputes snapshots for all three timeframes from the resulting daily history.
"""

import argparse
import logging
import sys
from datetime import date, timedelta

from src.config.settings import INITIAL_BACKFILL_DAYS, SNAPSHOT_TIMEFRAMES
from src.indicators.compute import compute_snapshot
from src.repositories.market_data_repository import (
    _get_client,
    enforce_retention,
    get_ticker_history,
    upsert_bars,
    upsert_snapshot,
    upsert_symbol_metadata,
)
from src.utils.market_data_fetcher import fetch_bars
from src.utils.symbol_metadata import fetch_symbol_metadata_yfinance
from src.utils.timeframe_aggregation import aggregate_bars

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("backfill_deep_history")
logging.getLogger("httpx").setLevel(logging.WARNING)


def get_snapshot_tickers() -> list[tuple[str, str]]:
    client = _get_client()
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        result = (
            client.table("symbol_indicator_snapshot")
            .select("ticker,market")
            .eq("timeframe", "1D")
            .order("ticker")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        page = result.data or []
        if not page:
            break
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    seen: dict[str, str] = {}
    for row in rows:
        ticker = str(row["ticker"]).upper()
        market = str(row.get("market") or ("TA" if ticker.endswith(".TA") else "US")).upper()
        seen[ticker] = market
    return sorted(seen.items())


def get_earliest_trade_date(ticker: str) -> date | None:
    client = _get_client()
    result = (
        client.table("market_raw_data")
        .select("trade_date")
        .eq("ticker", ticker)
        .order("trade_date", desc=False)
        .limit(1)
        .execute()
    )
    if result.data:
        return date.fromisoformat(result.data[0]["trade_date"])
    return None


def get_symbol_metadata_row(ticker: str) -> dict | None:
    client = _get_client()
    result = (
        client.table("symbol_metadata")
        .select("listing_exchange,market_cap")
        .eq("ticker", ticker)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


def recompute_ticker(ticker: str, market: str) -> bool:
    history = get_ticker_history(ticker)
    if history.empty:
        logger.warning("%s: no history after backfill, skipping snapshot recompute", ticker)
        return False

    wrote_any = False
    for timeframe in SNAPSHOT_TIMEFRAMES:
        aggregated = aggregate_bars(history, timeframe, market=market)
        snapshot = compute_snapshot(
            ticker,
            aggregated,
            market=market,
            timeframe=timeframe,
        )
        if snapshot is None:
            continue
        upsert_snapshot(snapshot)
        wrote_any = True

    metadata_row = get_symbol_metadata_row(ticker) or {}
    listing_exchange = metadata_row.get("listing_exchange")
    market_cap = metadata_row.get("market_cap")
    should_refresh_metadata = market == "US" and (
        not isinstance(listing_exchange, str) or not listing_exchange.strip() or market_cap is None
    )
    metadata = fetch_symbol_metadata_yfinance(ticker) if should_refresh_metadata else {}
    upsert_symbol_metadata(
        ticker,
        market=market,
        listing_exchange="TASE" if market == "TA" else (metadata.get("listing_exchange") or listing_exchange),
        market_cap=metadata.get("market_cap") if metadata.get("market_cap") is not None else market_cap,
    )
    return wrote_any


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill deep daily history")
    parser.add_argument("--tickers", nargs="*", help="Optional explicit tickers")
    parser.add_argument(
        "--recompute-only",
        action="store_true",
        help="Skip fetching and only recompute snapshots from current DB history",
    )
    args = parser.parse_args()

    target_start = date.today() - timedelta(days=INITIAL_BACKFILL_DAYS)
    ticker_rows = (
        [(ticker.upper(), "TA" if ticker.upper().endswith(".TA") else "US") for ticker in args.tickers]
        if args.tickers
        else get_snapshot_tickers()
    )
    total = len(ticker_rows)
    logger.info("Target start date: %s", target_start.isoformat())
    logger.info("Processing %d tickers", total)

    fetched = 0
    recomputed = 0
    failed = 0

    for index, (ticker, market) in enumerate(ticker_rows, start=1):
        try:
            earliest = get_earliest_trade_date(ticker)
            if not args.recompute_only and (earliest is None or earliest > target_start):
                fetch_end = (earliest - timedelta(days=1)) if earliest else date.today()
                if target_start <= fetch_end:
                    bars = fetch_bars(ticker, target_start, fetch_end)
                    if bars is not None and not bars.empty:
                        inserted = upsert_bars(ticker, bars)
                        enforce_retention(ticker)
                        fetched += 1
                        logger.info(
                            "[%d/%d] %s fetched=%d earliest_before=%s range=%s..%s",
                            index,
                            total,
                            ticker,
                            inserted,
                            earliest.isoformat() if earliest else "none",
                            target_start.isoformat(),
                            fetch_end.isoformat(),
                        )
                    else:
                        logger.warning(
                            "[%d/%d] %s no provider data for %s..%s",
                            index,
                            total,
                            ticker,
                            target_start.isoformat(),
                            fetch_end.isoformat(),
                        )

            if recompute_ticker(ticker, market):
                recomputed += 1
            logger.info("[%d/%d] %s snapshots updated", index, total, ticker)
        except Exception as exc:
            failed += 1
            logger.exception("[%d/%d] %s failed: %s", index, total, ticker, exc)

    logger.info(
        "Done. fetched=%d recomputed=%d failed=%d total=%d",
        fetched,
        recomputed,
        failed,
        total,
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
