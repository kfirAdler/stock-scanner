from __future__ import annotations

import pandas as pd


def _week_end_offset(weekday: int, market: str) -> int:
    target = 3 if market == "TA" else 4
    return (target - weekday) % 7


def aggregate_bars(df: pd.DataFrame, timeframe: str, *, market: str) -> pd.DataFrame:
    if df.empty:
        return df.copy()

    frame = df.copy()
    dates = pd.to_datetime(frame["trade_date"])
    frame["trade_date_ts"] = dates

    if timeframe == "1D":
        return frame.drop(columns=["trade_date_ts"])

    if timeframe == "1W":
        frame["bucket"] = dates + pd.to_timedelta(
            dates.dt.weekday.map(lambda day: _week_end_offset(int(day), market)),
            unit="D",
        )
    elif timeframe == "1M":
        frame["bucket"] = dates.dt.to_period("M").dt.to_timestamp("M")
    else:
        raise ValueError(f"Unsupported timeframe: {timeframe}")

    agg_map: dict[str, str] = {
        "trade_date": "last",
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
    }
    if "bar_time" in frame.columns:
        agg_map["bar_time"] = "last"
    agg = frame.groupby("bucket", sort=True).agg(agg_map)
    agg = agg.reset_index(drop=True)
    if "bar_time" not in agg.columns:
        agg["bar_time"] = pd.NaT
    return agg[["trade_date", "open", "high", "low", "close", "volume", "bar_time"]]
