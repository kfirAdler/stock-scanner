"""Sequence signal computation translated from Pine Script.

TODO: Replace this stub with the actual Pine-derived sequence logic
once the Pine Script source is provided. The current implementation
uses a simplified placeholder that tracks consecutive up/down closes.
"""

from dataclasses import dataclass
from typing import Optional

import pandas as pd

from ..config.settings import SEQUENCE_RECENT_THRESHOLD


@dataclass
class SequenceState:
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


def compute_sequence_state(df: pd.DataFrame) -> SequenceState:
    """Compute sequence state from bar history.

    This is a STUB implementation. It tracks consecutive closes above/below
    the close from 4 bars ago (a simplified TD Sequential-style count).
    The real implementation must be translated from the provided Pine Script.
    """
    if len(df) < 10:
        return SequenceState()

    close = df["close"].astype(float).values
    n = len(close)

    up_count = 0
    down_count = 0
    last_up_break_idx: Optional[int] = None
    last_down_break_idx: Optional[int] = None
    max_up_count = 0
    max_down_count = 0

    for i in range(4, n):
        if close[i] > close[i - 4]:
            up_count += 1
            if down_count >= 4:
                last_down_break_idx = i
            down_count = 0
        elif close[i] < close[i - 4]:
            down_count += 1
            if up_count >= 4:
                last_up_break_idx = i
            up_count = 0
        else:
            if up_count >= 4:
                last_up_break_idx = i
            if down_count >= 4:
                last_down_break_idx = i
            up_count = 0
            down_count = 0

        max_up_count = max(max_up_count, up_count)
        max_down_count = max(max_down_count, down_count)

    bullish_active = up_count >= 1
    bearish_active = down_count >= 1

    up_break_bars_ago: Optional[int] = None
    down_break_bars_ago: Optional[int] = None

    if last_up_break_idx is not None:
        up_break_bars_ago = (n - 1) - last_up_break_idx

    if last_down_break_idx is not None:
        down_break_bars_ago = (n - 1) - last_down_break_idx

    strong_up = max_up_count >= 9
    strong_down = max_down_count >= 9

    up_broke_recently = (
        up_break_bars_ago is not None
        and up_break_bars_ago <= SEQUENCE_RECENT_THRESHOLD
    )
    down_broke_recently = (
        down_break_bars_ago is not None
        and down_break_bars_ago <= SEQUENCE_RECENT_THRESHOLD
    )

    return SequenceState(
        bullish_sequence_active=bullish_active,
        bearish_sequence_active=bearish_active,
        strong_up_sequence_context=strong_up,
        strong_down_sequence_context=strong_down,
        up_sequence_count=up_count,
        down_sequence_count=down_count,
        up_sequence_break_bars_ago=up_break_bars_ago,
        down_sequence_break_bars_ago=down_break_bars_ago,
        up_sequence_broke_recently=up_broke_recently,
        down_sequence_broke_recently=down_broke_recently,
        down_sequence_broke_in_strong_up_context=down_broke_recently and strong_up,
        up_sequence_broke_in_strong_down_context=up_broke_recently and strong_down,
        buy_signal=down_count >= 9,
        sell_signal=up_count >= 9,
        strong_buy_signal=down_count >= 13,
        strong_sell_signal=up_count >= 13,
    )
