"""Fetch current S&P 500 ticker list from Wikipedia."""

import logging

import pandas as pd

from ..config.settings import SP500_TICKER_SOURCE

logger = logging.getLogger(__name__)


def get_sp500_tickers() -> list[str]:
    try:
        tables = pd.read_html(SP500_TICKER_SOURCE)
        df = tables[0]
        tickers = df["Symbol"].tolist()
        tickers = [t.replace(".", "-") for t in tickers]
        logger.info("Loaded %d S&P 500 tickers", len(tickers))
        return sorted(tickers)
    except Exception:
        logger.exception("Failed to fetch S&P 500 ticker list")
        raise
