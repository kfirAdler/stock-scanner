"""Resolve primary US listing to TradingView-style exchange prefix."""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

_YF_TO_TV = {
    "NYQ": "NYSE",
    "NYSE": "NYSE",
    "PCX": "NYSE",
    "NMS": "NASDAQ",
    "NASDAQ": "NASDAQ",
    "NCM": "NASDAQ",
    "NGM": "NASDAQ",
    "NGS": "NASDAQ",
    "ASE": "AMEX",
    "AMEX": "AMEX",
    "BTS": "BATS",
    "BATS": "BATS",
    "BZX": "BATS",
}


def map_yfinance_mic_to_tv(mic: str | None) -> str | None:
    if not mic or not isinstance(mic, str):
        return None
    key = mic.strip().upper()
    return _YF_TO_TV.get(key)


def fetch_listing_exchange_yfinance(ticker: str) -> str | None:
    """Return NYSE / NASDAQ / AMEX / BATS for TradingView, or None."""
    try:
        import yfinance as yf

        ysym = ticker.replace(".", "-")
        t = yf.Ticker(ysym)
        mic: Optional[str] = None
        fi = getattr(t, "fast_info", None)
        if fi is not None:
            mic = getattr(fi, "exchange", None) or getattr(fi, "exchange_key", None)
        if not mic:
            full = t.info or {}
            mic = full.get("exchange")
        tv = map_yfinance_mic_to_tv(mic if isinstance(mic, str) else None)
        if tv:
            return tv
    except Exception:
        logger.debug("yfinance exchange lookup failed for %s", ticker, exc_info=True)
    return None
