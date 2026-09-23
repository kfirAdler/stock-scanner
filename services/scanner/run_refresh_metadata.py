#!/usr/bin/env python3
"""Refresh company metadata independently, at most once per UTC day."""
import argparse
import logging
from datetime import datetime, timezone

from src.jobs.universe import tickers_for_refresh_universe
from src.repositories.market_data_repository import get_refresh_rows, upsert_symbol_metadata
from src.utils.symbol_metadata import fetch_symbol_metadata_yfinance

logger = logging.getLogger(__name__)


def run(tickers: list[str]) -> int:
    existing = {row["ticker"]: row for row in get_refresh_rows(
        "symbol_metadata", "ticker,updated_at", tickers)}
    today = datetime.now(timezone.utc).date().isoformat()
    failed = 0
    for ticker in tickers:
        if str(existing.get(ticker, {}).get("updated_at", ""))[:10] == today:
            continue
        try:
            metadata = fetch_symbol_metadata_yfinance(ticker)
            if not any(value is not None for value in metadata.values()):
                raise RuntimeError("Yahoo returned no metadata")
            market = "TA" if ticker.endswith(".TA") else "US"
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
