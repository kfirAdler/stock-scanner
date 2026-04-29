from datetime import date, timedelta

import pandas as pd

from src.indicators.compute import compute_snapshot
from src.indicators.fibonacci import compute_fibonacci_state
from src.signals.sequence import SequenceState
from src.utils.timeframe_aggregation import aggregate_bars


def _daily_df(start: date, bars: list[tuple[float, float, float, float]]) -> pd.DataFrame:
    rows = []
    for i, (o, h, l, c) in enumerate(bars):
        rows.append({
            "trade_date": start + timedelta(days=i),
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": 1000 + i,
            "bar_time": pd.Timestamp(start + timedelta(days=i)),
        })
    return pd.DataFrame(rows)


def test_weekly_aggregation_uses_friday_for_us():
    df = _daily_df(
        date(2025, 1, 6),
        [
            (10, 11, 9, 10.5),
            (10.5, 12, 10, 11.5),
            (11.5, 13, 11, 12.5),
            (12.5, 14, 12, 13.5),
            (13.5, 15, 13, 14.5),
        ],
    )
    weekly = aggregate_bars(df, "1W", market="US")
    assert len(weekly) == 1
    row = weekly.iloc[0]
    assert row["trade_date"] == date(2025, 1, 10)
    assert float(row["open"]) == 10
    assert float(row["high"]) == 15
    assert float(row["low"]) == 9
    assert float(row["close"]) == 14.5


def test_weekly_aggregation_uses_thursday_for_ta():
    df = _daily_df(
        date(2025, 1, 5),
        [
            (20, 22, 19, 21),
            (21, 23, 20, 22),
            (22, 24, 21, 23),
            (23, 25, 22, 24),
            (24, 26, 23, 25),
        ],
    )
    weekly = aggregate_bars(df, "1W", market="TA")
    assert len(weekly) == 1
    assert weekly.iloc[0]["trade_date"] == date(2025, 1, 9)


def test_monthly_snapshot_uses_requested_timeframe():
    bars = []
    start = date(2023, 1, 1)
    for i in range(800):
        price = 100 + i * 0.2
        bars.append((price - 1, price + 1, price - 2, price))
    daily = _daily_df(start, bars)
    monthly = aggregate_bars(daily, "1M", market="US")
    snapshot = compute_snapshot("AAPL", monthly, market="US", timeframe="1M")
    assert snapshot is not None
    assert snapshot.timeframe == "1M"
    assert snapshot.close > 0


def test_fibonacci_zone_for_completed_up_sequence():
    fib = compute_fibonacci_state(
        SequenceState(
            last_completed_sequence_side="up",
            last_completed_sequence_low=100,
            last_completed_sequence_high=200,
        ),
        close=145,
    )
    assert fib.level_500 == 150
    assert fib.zone_500_618
    assert not fib.zone_382_500
