from dataclasses import dataclass, field
from datetime import date, datetime
import math
from typing import Any, Optional

import numpy as np


def _json_scalar(value: Any) -> Any:
    """Convert snapshot field values to JSON-safe types (no NaN / inf)."""
    if value is None:
        return None
    if hasattr(value, "__class__") and value.__class__.__name__ == "NaTType":
        return None
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, bool):
        return value
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, int) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, (float, np.floating)):
        x = float(value)
        if math.isnan(x) or math.isinf(x):
            return None
        return x
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return value


@dataclass
class IndicatorSnapshot:
    ticker: str
    timeframe: str
    last_trade_date: date
    close: float
    market: str = "US"
    last_bar_time: Optional[datetime] = None

    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    sma_150: Optional[float] = None
    sma_200: Optional[float] = None
    ema_20: Optional[float] = None

    bb_middle_20_2: Optional[float] = None
    bb_upper_20_2: Optional[float] = None
    bb_lower_20_2: Optional[float] = None
    pct_to_bb_upper: Optional[float] = None
    pct_to_bb_lower: Optional[float] = None

    atr_14: Optional[float] = None
    atr_percent: Optional[float] = None

    bullish_sequence_active: bool = False
    bearish_sequence_active: bool = False
    strong_up_sequence_context: bool = False
    strong_down_sequence_context: bool = False
    up_sequence_count: int = 0
    down_sequence_count: int = 0

    up_sequence_break_bars_ago: Optional[int] = None
    down_sequence_break_bars_ago: Optional[int] = None
    up_sequence_broke_recently: bool = False
    down_sequence_broke_recently: bool = False
    down_sequence_broke_in_strong_up_context: bool = False
    up_sequence_broke_in_strong_down_context: bool = False

    buy_signal: bool = False
    sell_signal: bool = False
    strong_buy_signal: bool = False
    strong_sell_signal: bool = False
    strong_buy_signal_bars_ago: Optional[int] = None
    strong_sell_signal_bars_ago: Optional[int] = None

    is_above_sma20: Optional[bool] = None
    is_below_sma20: Optional[bool] = None
    is_above_sma50: Optional[bool] = None
    is_below_sma50: Optional[bool] = None
    is_above_sma150: Optional[bool] = None
    is_below_sma150: Optional[bool] = None
    is_above_sma200: Optional[bool] = None
    is_below_sma200: Optional[bool] = None

    updated_at: Optional[datetime] = field(default=None)

    def to_dict(self) -> dict:
        d = {}
        for k, v in self.__dict__.items():
            if k == "updated_at" and v is None:
                continue
            d[k] = _json_scalar(v)
        return d
