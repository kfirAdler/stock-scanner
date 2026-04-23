"""Sequence failure signal computation translated from Pine Script.

Faithfully translates the 'Kfir Adler - Full Pack' Pine Script v6 indicator's:
- Sequence failure signals (buy/sell on sequence break)
- Strong buy signal (bullish candle body + close > max-high close in down seq)
- Williams Fractals with alternation enforcement
- Fractal-based trend context (HH/HL = uptrend, LH/LL = downtrend)

Pine Script rules translated:
- Up-sequence continues while: close > upMaxLow (anchor low of the highest bar)
- Up-sequence BREAKS when: close <= upMaxLow → SELL signal candidate
- Down-sequence continues while: close < downMinHigh (anchor high of the lowest bar)
- Down-sequence BREAKS when: close >= downMinHigh → BUY signal candidate
- Signals are suppressed if consecutive same-direction (alternation)
- Strong BUY: buy signal + bullish body ratio >= 0.6 + close > downMaxHighClose
"""

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

SEQUENCE_RECENT_THRESHOLD = 2
FRACTAL_N = 2
MIN_SEQ_BARS = 1
BULLISH_BODY_THRESHOLD = 0.6


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


def _is_up_fractal(highs: np.ndarray, center: int, n: int) -> bool:
    """Check if bar at `center` is a Williams up-fractal (local high).

    Right side: all n bars after center must have strictly lower highs.
    Left side: at least one of 5 patterns must match, allowing 0-4 immediately
    adjacent equal bars before requiring strictly lower bars.
    """
    length = len(highs)
    ch = highs[center]

    for i in range(1, n + 1):
        if center + i >= length or highs[center + i] >= ch:
            return False

    for k in range(5):
        valid = True
        for j in range(1, k + 1):
            idx = center - j
            if idx < 0 or highs[idx] > ch:
                valid = False
                break
        if not valid:
            continue
        for j in range(1, n + 1):
            idx = center - k - j
            if idx < 0 or highs[idx] >= ch:
                valid = False
                break
        if valid:
            return True

    return False


def _is_down_fractal(lows: np.ndarray, center: int, n: int) -> bool:
    """Check if bar at `center` is a Williams down-fractal (local low).

    Mirror of up-fractal: right side must have higher lows, left side patterns
    allow 0-4 adjacent equal lows.
    """
    length = len(lows)
    cl = lows[center]

    for i in range(1, n + 1):
        if center + i >= length or lows[center + i] <= cl:
            return False

    for k in range(5):
        valid = True
        for j in range(1, k + 1):
            idx = center - j
            if idx < 0 or lows[idx] < cl:
                valid = False
                break
        if not valid:
            continue
        for j in range(1, n + 1):
            idx = center - k - j
            if idx < 0 or lows[idx] <= cl:
                valid = False
                break
        if valid:
            return True

    return False


def compute_sequence_state(df: pd.DataFrame) -> SequenceState:
    """Process all bars and return the final sequence state.

    Iterates bar-by-bar in chronological order, maintaining:
    1. Williams Fractal detection with alternation enforcement
    2. Fractal-based trend context (strong up/down)
    3. Sequence failure state machine (up/down/neutral)
    4. Buy/sell/strong signal generation
    """
    if len(df) < 10:
        return SequenceState()

    opens = df["open"].astype(float).values
    highs = df["high"].astype(float).values
    lows = df["low"].astype(float).values
    closes = df["close"].astype(float).values
    n_bars = len(closes)

    # --- Fractal tracking state ---
    last_fractal_type = -1  # -1=never, 0=last was down, 1=last was up
    last_frac_high: Optional[float] = None
    prev_frac_high: Optional[float] = None
    last_frac_low: Optional[float] = None
    prev_frac_low: Optional[float] = None

    # --- Sequence state machine (matches Pine `var` declarations) ---
    seq_side = 0  # 0=neutral, 1=up, -1=down
    up_seq_count = 0
    down_seq_count = 0
    up_max_high: Optional[float] = None
    up_max_low: Optional[float] = None
    up_max_close: Optional[float] = None
    down_min_low: Optional[float] = None
    down_min_high: Optional[float] = None
    down_max_high: Optional[float] = None
    down_max_high_close: Optional[float] = None
    last_signal_dir = 0  # 1=last was buy, -1=last was sell

    # --- Signal tracking for bars_ago computation ---
    last_buy_bar: Optional[int] = None
    last_sell_bar: Optional[int] = None
    last_buy_in_strong_up = False
    last_sell_in_strong_down = False

    strong_up_ctx = False
    strong_down_ctx = False

    current_buy = False
    current_sell = False
    current_strong_buy = False
    current_strong_sell = False  # never set True per Pine code

    for i in range(n_bars):
        # ===== 1. Fractal detection (confirmed at bar i, centered at i - n) =====
        center = i - FRACTAL_N
        if center >= 0:
            if _is_up_fractal(highs, center, FRACTAL_N):
                if last_fractal_type != 1:
                    prev_frac_high = last_frac_high
                    last_frac_high = float(highs[center])
                    last_fractal_type = 1

            if _is_down_fractal(lows, center, FRACTAL_N):
                if last_fractal_type != 0:
                    prev_frac_low = last_frac_low
                    last_frac_low = float(lows[center])
                    last_fractal_type = 0

        # ===== 2. Fractal-based trend context =====
        if (last_frac_low is not None and prev_frac_low is not None and
                last_frac_high is not None and prev_frac_high is not None):
            strong_up_ctx = (
                last_frac_low >= prev_frac_low and
                last_frac_high > prev_frac_high
            )
            strong_down_ctx = (
                last_frac_high <= prev_frac_high and
                last_frac_low < prev_frac_low
            )

        # ===== 3. Sequence failure state machine =====
        current_buy = False
        current_sell = False
        current_strong_buy = False
        current_strong_sell = False

        c = closes[i]
        o = opens[i]
        h = highs[i]
        lo = lows[i]

        if i == 0:
            up_continues = False
            down_continues = False
        else:
            prev_lo = lows[i - 1]
            prev_hi = highs[i - 1]
            up_continues = c > (prev_lo if up_max_low is None else up_max_low)
            down_continues = c < (prev_hi if down_min_high is None else down_min_high)

        if seq_side == 0:
            if up_continues and not down_continues:
                seq_side = 1
                up_seq_count = 1
                down_seq_count = 0
                up_max_high = h
                up_max_low = lo
                up_max_close = c
                down_min_low = None
                down_min_high = None
                down_max_high = None
                down_max_high_close = None
            elif down_continues and not up_continues:
                seq_side = -1
                down_seq_count = 1
                up_seq_count = 0
                down_min_low = lo
                down_min_high = h
                down_max_high = h
                down_max_high_close = c
                up_max_high = None
                up_max_low = None
                up_max_close = None

        elif seq_side == 1:
            if up_continues:
                up_seq_count += 1
                if up_max_high is None or h >= up_max_high:
                    up_max_high = h
                    up_max_low = lo
                    up_max_close = c
            else:
                if (up_seq_count >= MIN_SEQ_BARS and c < o
                        and last_signal_dir != -1):
                    current_sell = True
                elif up_seq_count >= MIN_SEQ_BARS and last_signal_dir == -1:
                    if up_max_high is not None and h >= up_max_high:
                        up_max_high = h
                        up_max_low = lo
                        up_max_close = c

                if up_max_low is not None and c < up_max_low:
                    seq_side = -1
                    down_seq_count = 1
                    up_seq_count = 0
                    down_min_low = lo
                    down_min_high = h
                    down_max_high = h
                    down_max_high_close = c
                    up_max_high = None
                    up_max_low = None
                    up_max_close = None
                else:
                    seq_side = 0
                    up_seq_count = 0
                    down_seq_count = 0
                    up_max_high = None
                    up_max_low = None
                    up_max_close = None
                    down_min_low = None
                    down_min_high = None
                    down_max_high = None
                    down_max_high_close = None

        elif seq_side == -1:
            if down_continues:
                down_seq_count += 1
                if down_min_low is None or lo <= down_min_low:
                    down_min_low = lo
                    down_min_high = h
                if down_max_high is None or h > down_max_high:
                    down_max_high = h
                    down_max_high_close = c
            else:
                if (down_seq_count >= MIN_SEQ_BARS and c >= o
                        and last_signal_dir != 1):
                    current_buy = True
                    candle_range = h - lo
                    body_ratio = (c - o) / candle_range if candle_range > 0 else 0.0
                    is_bullish = c >= o and body_ratio >= BULLISH_BODY_THRESHOLD
                    above_max_close = (
                        down_max_high_close is not None and c > down_max_high_close
                    )
                    current_strong_buy = is_bullish and above_max_close
                elif down_seq_count >= MIN_SEQ_BARS and last_signal_dir == 1:
                    if down_max_high is not None and h > down_max_high:
                        down_max_high = h
                        down_max_high_close = c

                if down_min_high is not None and c > down_min_high:
                    seq_side = 1
                    up_seq_count = 1
                    down_seq_count = 0
                    up_max_high = h
                    up_max_low = lo
                    up_max_close = c
                    down_min_low = None
                    down_min_high = None
                    down_max_high = None
                    down_max_high_close = None
                else:
                    seq_side = 0
                    up_seq_count = 0
                    down_seq_count = 0
                    up_max_high = None
                    up_max_low = None
                    up_max_close = None
                    down_min_low = None
                    down_min_high = None
                    down_max_high = None
                    down_max_high_close = None

        # ===== 4. Update signal tracking =====
        if current_sell:
            last_signal_dir = -1
            last_sell_bar = i
            last_sell_in_strong_down = strong_down_ctx
        if current_buy:
            last_signal_dir = 1
            last_buy_bar = i
            last_buy_in_strong_up = strong_up_ctx

    # ===== Build final snapshot state =====
    last_bar = n_bars - 1

    # "down sequence broke" = buy signal (a down seq ended)
    down_break_bars_ago: Optional[int] = None
    if last_buy_bar is not None:
        down_break_bars_ago = last_bar - last_buy_bar

    # "up sequence broke" = sell signal (an up seq ended)
    up_break_bars_ago: Optional[int] = None
    if last_sell_bar is not None:
        up_break_bars_ago = last_bar - last_sell_bar

    down_broke_recently = (
        down_break_bars_ago is not None
        and down_break_bars_ago <= SEQUENCE_RECENT_THRESHOLD
    )
    up_broke_recently = (
        up_break_bars_ago is not None
        and up_break_bars_ago <= SEQUENCE_RECENT_THRESHOLD
    )

    return SequenceState(
        bullish_sequence_active=(seq_side == 1),
        bearish_sequence_active=(seq_side == -1),
        strong_up_sequence_context=strong_up_ctx,
        strong_down_sequence_context=strong_down_ctx,
        up_sequence_count=up_seq_count,
        down_sequence_count=down_seq_count,
        up_sequence_break_bars_ago=up_break_bars_ago,
        down_sequence_break_bars_ago=down_break_bars_ago,
        up_sequence_broke_recently=up_broke_recently,
        down_sequence_broke_recently=down_broke_recently,
        down_sequence_broke_in_strong_up_context=(
            down_broke_recently and last_buy_in_strong_up
        ),
        up_sequence_broke_in_strong_down_context=(
            up_broke_recently and last_sell_in_strong_down
        ),
        buy_signal=current_buy,
        sell_signal=current_sell,
        strong_buy_signal=current_strong_buy,
        strong_sell_signal=current_strong_sell,
    )
