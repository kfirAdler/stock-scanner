from __future__ import annotations

import sys
from types import SimpleNamespace

import pytest

from src.utils.symbol_metadata import fetch_symbol_metadata_yfinance


def test_fetch_symbol_metadata_includes_company_and_sector(monkeypatch: pytest.MonkeyPatch):
    requested_symbols: list[str] = []

    class FakeTicker:
        def __init__(self, symbol: str):
            requested_symbols.append(symbol)
            self.fast_info = SimpleNamespace(market_cap=123_000_000, exchange="NMS")
            self.info = {
                "longName": "  Example Holdings  ",
                "sector": "Technology",
                "industry": "Software - Infrastructure",
                "returnOnEquity": 0.21,
                "totalDebt": 40,
                "totalStockholderEquity": 100,
            }

    monkeypatch.setitem(sys.modules, "yfinance", SimpleNamespace(Ticker=FakeTicker))

    metadata = fetch_symbol_metadata_yfinance("BRK.B")

    assert requested_symbols == ["BRK-B"]
    assert metadata["company_name"] == "Example Holdings"
    assert metadata["sector"] == "Technology"
    assert metadata["industry"] == "Software - Infrastructure"
    assert metadata["market_cap"] == 123_000_000
    assert metadata["return_on_equity"] == pytest.approx(21)
    assert metadata["debt_to_equity"] == pytest.approx(0.4)


def test_fetch_symbol_metadata_preserves_tel_aviv_suffix(monkeypatch: pytest.MonkeyPatch):
    requested_symbols: list[str] = []

    class FakeTicker:
        def __init__(self, symbol: str):
            requested_symbols.append(symbol)
            self.fast_info = None
            self.info = {
                "shortName": "Tel Aviv Company",
                "sector": "Industrials",
                "industry": "Specialty Industrial Machinery",
                "exchange": "TLV",
            }

    monkeypatch.setitem(sys.modules, "yfinance", SimpleNamespace(Ticker=FakeTicker))

    metadata = fetch_symbol_metadata_yfinance("TEVA.TA")

    assert requested_symbols == ["TEVA.TA"]
    assert metadata["company_name"] == "Tel Aviv Company"
    assert metadata["sector"] == "Industrials"
    assert metadata["industry"] == "Specialty Industrial Machinery"
