"""Ticker universes refreshed by the market snapshot job."""

from __future__ import annotations

from ..utils.ta125_ticker_list import get_ta125_tickers
from ..utils.ticker_list import get_sp500_tickers


def tickers_for_refresh_universe(universe: str) -> list[str]:
    u = (universe or "all").strip().lower()
    if u == "us":
        return get_sp500_tickers()
    if u == "ta":
        return get_ta125_tickers()
    if u == "all":
        return sorted(set(get_sp500_tickers()) | set(get_ta125_tickers()))
    raise ValueError(f"Unknown universe {universe!r}; use all, us, or ta")
