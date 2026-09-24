#!/usr/bin/env python3
"""Refresh company metadata independently with a retry cooldown."""
import argparse
import logging
from datetime import datetime, timedelta, timezone

from src.jobs.universe import tickers_for_refresh_universe
from src.repositories.market_data_repository import (
    get_refresh_rows,
    upsert_symbol_market,
    upsert_symbol_metadata,
)
from src.utils.symbol_metadata import fetch_symbol_metadata_yfinance

logger = logging.getLogger(__name__)
METADATA_REFRESH_DAYS = 7


def recently_checked(updated_at: object, now: datetime) -> bool:
    if not updated_at:
        return False
    try:
        checked = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
        if checked.tzinfo is None:
            checked = checked.replace(tzinfo=timezone.utc)
        return checked >= now - timedelta(days=METADATA_REFRESH_DAYS)
    except ValueError:
        return False


def run(tickers: list[str]) -> int:
    existing = {row["ticker"]: row for row in get_refresh_rows(
        "symbol_metadata", "ticker,updated_at", tickers)}
    now = datetime.now(timezone.utc)
    failed = 0
    for ticker in tickers:
        if recently_checked(existing.get(ticker, {}).get("updated_at"), now):
            continue
        try:
            metadata = fetch_symbol_metadata_yfinance(ticker)
            market = "TA" if ticker.endswith(".TA") else "US"
            if not any(value is not None for value in metadata.values()):
                # Yahoo has no profile for some index constituents. Record the
                # check without deleting existing metadata, then retry after
                # the normal cooldown instead of failing every workflow run.
                upsert_symbol_market(ticker, market)
                logger.warning("Yahoo returned no metadata for %s; skipping", ticker)
                continue
            if market == "TA":
                metadata["listing_exchange"] = "TASE"
            upsert_symbol_metadata(ticker, market=market, **metadata)
        except Exception:
            failed += 1
            logger.exception("Metadata refresh failed for %s", ticker)
    return failed


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tickers", nargs="+")
    parser.add_argument("--universe", choices=("all", "us", "ta"), default="all")
    args = parser.parse_args()
    tickers = args.tickers or tickers_for_refresh_universe(args.universe)
    raise SystemExit(1 if run(sorted({t.strip().upper() for t in tickers})) else 0)
