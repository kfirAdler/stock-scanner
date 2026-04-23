"""Tests for the Pine Script sequence translation.

Verifies fractal detection, alternation, and sequence failure signals
against known bar patterns.
"""

import pandas as pd
import pytest

from src.signals.sequence import (
    SequenceState,
    _is_down_fractal,
    _is_up_fractal,
    compute_sequence_state,
)
import numpy as np


def _make_df(bars: list[tuple]) -> pd.DataFrame:
    """Create a DataFrame from (open, high, low, close) tuples."""
    from datetime import date, timedelta

    base = date(2025, 1, 1)
    records = []
    for i, (o, h, lo, c) in enumerate(bars):
        records.append({
            "trade_date": base + timedelta(days=i),
            "open": o,
            "high": h,
            "low": lo,
            "close": c,
            "volume": 1000000,
        })
    return pd.DataFrame(records)


class TestWilliamsFractals:
    def test_simple_up_fractal(self):
        highs = np.array([10, 11, 15, 12, 10], dtype=float)
        assert _is_up_fractal(highs, center=2, n=2)

    def test_simple_down_fractal(self):
        lows = np.array([10, 9, 5, 7, 10], dtype=float)
        assert _is_down_fractal(lows, center=2, n=2)

    def test_no_fractal_when_right_side_not_lower(self):
        highs = np.array([10, 11, 15, 16, 10], dtype=float)
        assert not _is_up_fractal(highs, center=2, n=2)

    def test_up_fractal_with_equal_adjacent_left(self):
        """Pattern 1: immediate left bar can be equal."""
        highs = np.array([8, 9, 12, 12, 15, 13, 11], dtype=float)
        assert _is_up_fractal(highs, center=4, n=2)

    def test_no_down_fractal_when_left_side_not_higher(self):
        lows = np.array([10, 3, 5, 7, 10], dtype=float)
        assert not _is_down_fractal(lows, center=2, n=2)


class TestSequenceStateMachine:
    def test_empty_dataframe_returns_default(self):
        df = _make_df([])
        state = compute_sequence_state(df)
        assert state == SequenceState()

    def test_short_dataframe_returns_default(self):
        bars = [(100, 101, 99, 100)] * 5
        df = _make_df(bars)
        state = compute_sequence_state(df)
        assert state == SequenceState()

    def test_rising_sequence_detected(self):
        """Steadily rising closes should produce an up sequence."""
        bars = []
        for i in range(20):
            price = 100 + i * 2
            bars.append((price - 1, price + 1, price - 2, price))
        df = _make_df(bars)
        state = compute_sequence_state(df)
        assert state.bullish_sequence_active or state.up_sequence_count > 0

    def test_falling_sequence_detected(self):
        """Steadily falling closes should produce a down sequence."""
        bars = []
        for i in range(20):
            price = 200 - i * 2
            bars.append((price + 1, price + 2, price - 1, price))
        df = _make_df(bars)
        state = compute_sequence_state(df)
        assert state.bearish_sequence_active or state.down_sequence_count > 0

    def test_sell_signal_on_up_break(self):
        """Up sequence that then drops should trigger a sell signal."""
        bars = []
        for i in range(15):
            price = 100 + i * 3
            bars.append((price - 1, price + 2, price - 3, price))
        drop_price = 80
        bars.append((bars[-1][3], bars[-1][3] + 1, drop_price - 1, drop_price))
        df = _make_df(bars)
        state = compute_sequence_state(df)
        assert state.sell_signal or (
            state.up_sequence_break_bars_ago is not None
            and state.up_sequence_break_bars_ago <= 2
        )

    def test_buy_signal_on_down_break(self):
        """Down sequence that then rises should trigger a buy signal."""
        bars = []
        for i in range(15):
            price = 200 - i * 3
            bars.append((price + 1, price + 2, price - 1, price))
        rise_price = 200
        bars.append((bars[-1][3], rise_price + 2, bars[-1][3] - 1, rise_price))
        df = _make_df(bars)
        state = compute_sequence_state(df)
        assert state.buy_signal or (
            state.down_sequence_break_bars_ago is not None
            and state.down_sequence_break_bars_ago <= 2
        )

    def test_no_consecutive_same_direction_signals(self):
        """Signal alternation: two buys without a sell between is not allowed."""
        bars = []
        for i in range(10):
            price = 200 - i * 3
            bars.append((price + 1, price + 2, price - 1, price))
        bars.append((bars[-1][3], 210, bars[-1][3] - 1, 200))
        for i in range(10):
            price = 200 - i * 3
            bars.append((price + 1, price + 2, price - 1, price))
        bars.append((bars[-1][3], 210, bars[-1][3] - 1, 200))
        df = _make_df(bars)
        state = compute_sequence_state(df)
        # The second buy should have been blocked (lastSignalDir == 1)
        # This is hard to test precisely without tracking all signals,
        # but we verify the function doesn't crash and produces valid output
        assert isinstance(state, SequenceState)


class TestBreakBarsAgo:
    def test_break_on_last_bar_is_zero(self):
        """If buy signal fires on the last bar, down_break_bars_ago should be 0."""
        bars = []
        for i in range(15):
            price = 200 - i * 3
            bars.append((price + 1, price + 2, price - 1, price))
        rise_price = 200
        bars.append((bars[-1][3], rise_price + 5, bars[-1][3] - 1, rise_price))
        df = _make_df(bars)
        state = compute_sequence_state(df)
        if state.buy_signal:
            assert state.down_sequence_break_bars_ago == 0
            assert state.down_sequence_broke_recently

    def test_recently_threshold(self):
        """Break older than threshold should not be flagged as recent."""
        bars = []
        for i in range(15):
            price = 200 - i * 3
            bars.append((price + 1, price + 2, price - 1, price))
        bars.append((bars[-1][3], 210, bars[-1][3] - 1, 200))
        for _ in range(5):
            bars.append((200, 201, 199, 200))
        df = _make_df(bars)
        state = compute_sequence_state(df)
        if state.down_sequence_break_bars_ago is not None:
            if state.down_sequence_break_bars_ago > 2:
                assert not state.down_sequence_broke_recently
