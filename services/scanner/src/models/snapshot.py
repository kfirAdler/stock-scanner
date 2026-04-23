from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


@dataclass
class IndicatorSnapshot:
    ticker: str
    timeframe: str
    last_trade_date: date
    close: float
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
            if v is None and k == "updated_at":
                continue
            if isinstance(v, date) and not isinstance(v, datetime):
                d[k] = v.isoformat()
            elif isinstance(v, datetime):
                d[k] = v.isoformat()
            else:
                d[k] = v
        return d
