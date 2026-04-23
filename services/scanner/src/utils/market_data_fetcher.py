"""Fetch market data from stooq.com with yfinance fallback."""

import io
import logging
from datetime import date, timedelta

import pandas as pd
import requests

from ..config.settings import STOOQ_BASE_URL

logger = logging.getLogger(__name__)


def fetch_bars_stooq(
    ticker: str, start_date: date, end_date: date
) -> pd.DataFrame | None:
    stooq_ticker = ticker.replace("-", ".") + ".US"
    params = {
        "s": stooq_ticker.lower(),
        "d1": start_date.strftime("%Y%m%d"),
        "d2": end_date.strftime("%Y%m%d"),
        "i": "d",
    }
    try:
        resp = requests.get(STOOQ_BASE_URL, params=params, timeout=30)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text))
        if df.empty or "Close" not in df.columns:
            return None
        df = df.rename(columns={
            "Date": "trade_date",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        })
        df["trade_date"] = pd.to_datetime(df["trade_date"]).dt.date
        df = df.sort_values("trade_date").reset_index(drop=True)
        return df[["trade_date", "open", "high", "low", "close", "volume"]]
    except Exception:
        logger.warning("Stooq fetch failed for %s, trying yfinance", ticker)
        return None


def fetch_bars_yfinance(
    ticker: str, start_date: date, end_date: date
) -> pd.DataFrame | None:
    try:
        import yfinance as yf

        data = yf.download(
            ticker,
            start=start_date.isoformat(),
            end=(end_date + timedelta(days=1)).isoformat(),
            progress=False,
            auto_adjust=True,
        )
        if data.empty:
            return None

        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        df = data.reset_index()
        df = df.rename(columns={
            "Date": "trade_date",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        })
        df["trade_date"] = pd.to_datetime(df["trade_date"]).dt.date
        df = df.sort_values("trade_date").reset_index(drop=True)
        return df[["trade_date", "open", "high", "low", "close", "volume"]]
    except Exception:
        logger.exception("yfinance fetch failed for %s", ticker)
        return None


def fetch_bars(ticker: str, start_date: date, end_date: date) -> pd.DataFrame | None:
    df = fetch_bars_stooq(ticker, start_date, end_date)
    if df is not None and not df.empty:
        return df
    return fetch_bars_yfinance(ticker, start_date, end_date)
