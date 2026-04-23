import pandas as pd

from .moving_averages import sma


def bollinger_bands(
    close: pd.Series, period: int = 20, num_std: float = 2.0
) -> tuple[pd.Series, pd.Series, pd.Series]:
    middle = sma(close, period)
    rolling_std = close.rolling(window=period, min_periods=period).std()
    upper = middle + num_std * rolling_std
    lower = middle - num_std * rolling_std
    return middle, upper, lower


def pct_distance_to_band(close: pd.Series, band: pd.Series) -> pd.Series:
    return ((band - close) / close * 100).abs()
