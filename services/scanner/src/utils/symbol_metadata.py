from __future__ import annotations

import logging
from typing import Optional, TypedDict

from .listing_exchange import map_yfinance_mic_to_tv

logger = logging.getLogger(__name__)


class SymbolMetadata(TypedDict):
    market_cap: Optional[float]
    listing_exchange: Optional[str]
    return_on_equity: Optional[float]
    debt_to_equity: Optional[float]


def _to_optional_float(value: object) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


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

        roe = _to_optional_float(full.get("returnOnEquity"))
        if roe is not None and abs(roe) <= 1.5:
            roe *= 100.0

        total_debt = _to_optional_float(full.get("totalDebt"))
        total_equity = _to_optional_float(
            full.get("totalStockholderEquity")
            or full.get("stockholdersEquity")
            or full.get("totalShareholderEquity")
        )
        if total_debt is not None and total_equity not in (None, 0):
            debt_to_equity = total_debt / total_equity
        else:
            debt_to_equity = _to_optional_float(full.get("debtToEquity"))
            if debt_to_equity is not None and debt_to_equity > 10:
                debt_to_equity /= 100.0

        mic = full.get("exchange")
        if not mic and fast_info is not None:
            mic = getattr(fast_info, "exchange", None) or getattr(
                fast_info, "exchange_key", None
            )

        return {
            "market_cap": float(market_cap) if market_cap is not None else None,
            "listing_exchange": map_yfinance_mic_to_tv(mic if isinstance(mic, str) else None),
            "return_on_equity": roe,
            "debt_to_equity": debt_to_equity,
        }
    except Exception:
        logger.debug("yfinance metadata lookup failed for %s", ticker, exc_info=True)
        return {
            "market_cap": None,
            "listing_exchange": None,
            "return_on_equity": None,
            "debt_to_equity": None,
        }
