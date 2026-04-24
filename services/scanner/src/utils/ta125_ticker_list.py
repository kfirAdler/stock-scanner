"""Fetch current TA-125 constituents from Wikipedia and normalize to yfinance symbols."""

import logging

import pandas as pd

from ..config.settings import TA125_TICKER_SOURCE
from .wikipedia_tables import read_wikipedia_tables

logger = logging.getLogger(__name__)


def get_ta125_tickers() -> list[str]:
    tables = read_wikipedia_tables(TA125_TICKER_SOURCE)
    best: pd.DataFrame | None = None
    best_len = 0
    for df in tables:
        if "Symbol" not in df.columns:
            continue
        n = len(df)
        if 100 <= n <= 200 and n > best_len:
            best_len = n
            best = df
    if best is None:
        logger.error("No TA-125 constituents table with Symbol column")
        raise RuntimeError("TA-125 Wikipedia table not found")

    syms = (
        best["Symbol"]
        .dropna()
        .astype(str)
        .str.strip()
        .str.upper()
    )
    tickers = sorted({f"{s}.TA" for s in syms if s and s != "NAN"})
    logger.info("Loaded %d TA-125 tickers (unique .TA symbols)", len(tickers))
    return tickers
