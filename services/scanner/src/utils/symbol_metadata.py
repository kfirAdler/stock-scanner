from __future__ import annotations

import logging
from typing import Optional, TypedDict

from .listing_exchange import map_yfinance_mic_to_tv

logger = logging.getLogger(__name__)


class SymbolMetadata(TypedDict):
    market_cap: Optional[float]
    listing_exchange: Optional[str]


def fetch_symbol_metadata_yfinance(ticker: str) -> SymbolMetadata:
    try:
        import yfinance as yf

        ysym = ticker.replace(".", "-")
        t = yf.Ticker(ysym)
        fast_info = getattr(t, "fast_info", None)
        full = t.info or {}

        market_cap = full.get("marketCap")
        if market_cap is None and fast_info is not None:
            market_cap = getattr(fast_info, "market_cap", None)

        mic = full.get("exchange")
        if not mic and fast_info is not None:
            mic = getattr(fast_info, "exchange", None) or getattr(
                fast_info, "exchange_key", None
            )

        return {
            "market_cap": float(market_cap) if market_cap is not None else None,
            "listing_exchange": map_yfinance_mic_to_tv(mic if isinstance(mic, str) else None),
        }
    except Exception:
        logger.debug("yfinance metadata lookup failed for %s", ticker, exc_info=True)
        return {
            "market_cap": None,
            "listing_exchange": None,
        }
