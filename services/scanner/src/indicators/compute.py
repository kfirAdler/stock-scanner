"""Orchestrates all indicator computation for a single ticker's bar history."""

import pandas as pd

from ..config.settings import (
    ATR_PERIOD,
    BB_PERIOD,
    BB_STD_DEV,
    SEQUENCE_RECENT_THRESHOLD,
    SUPPORTED_SMA_LENGTHS,
    TIMEFRAME,
)
from ..models.snapshot import IndicatorSnapshot
from ..signals.sequence import compute_sequence_state
from .atr import atr, atr_percent
from .bollinger import bollinger_bands, pct_distance_to_band
from .moving_averages import ema, sma


def compute_snapshot(ticker: str, df: pd.DataFrame) -> IndicatorSnapshot | None:
    """Compute all indicators from OHLCV bars and return a snapshot for the latest bar.

    `df` must be sorted by trade_date ascending and contain columns:
    trade_date, open, high, low, close, volume.
    """
    if df.empty or len(df) < 20:
        return None

    close = df["close"].astype(float)
    high = df["high"].astype(float)
    low = df["low"].astype(float)

    sma_values: dict[int, pd.Series] = {}
    for length in SUPPORTED_SMA_LENGTHS:
        sma_values[length] = sma(close, length)

    ema_20 = ema(close, 20)

    bb_mid, bb_up, bb_low = bollinger_bands(close, BB_PERIOD, BB_STD_DEV)
    pct_bb_upper = pct_distance_to_band(close, bb_up)
    pct_bb_lower = pct_distance_to_band(close, bb_low)

    atr_series = atr(high, low, close, ATR_PERIOD)
    atr_pct = atr_percent(atr_series, close)

    seq_state = compute_sequence_state(df)

    last_idx = df.index[-1]
    last_row = df.iloc[-1]
    last_close = float(close.iloc[-1])

    def _latest(s: pd.Series) -> float | None:
        val = s.iloc[-1]
        return None if pd.isna(val) else round(float(val), 4)

    def _above(price: float, ma_val: float | None) -> bool | None:
        return price > ma_val if ma_val is not None else None

    def _below(price: float, ma_val: float | None) -> bool | None:
        return price < ma_val if ma_val is not None else None

    sma20 = _latest(sma_values[20])
    sma50 = _latest(sma_values[50])
    sma150 = _latest(sma_values[150])
    sma200 = _latest(sma_values[200])

    return IndicatorSnapshot(
        ticker=ticker,
        timeframe=TIMEFRAME,
        last_trade_date=last_row["trade_date"],
        last_bar_time=last_row.get("bar_time"),
        close=round(last_close, 4),
        sma_20=sma20,
        sma_50=sma50,
        sma_150=sma150,
        sma_200=sma200,
        ema_20=_latest(ema_20),
        bb_middle_20_2=_latest(bb_mid),
        bb_upper_20_2=_latest(bb_up),
        bb_lower_20_2=_latest(bb_low),
        pct_to_bb_upper=_latest(pct_bb_upper),
        pct_to_bb_lower=_latest(pct_bb_lower),
        atr_14=_latest(atr_series),
        atr_percent=_latest(atr_pct),
        # Sequence state
        bullish_sequence_active=seq_state.bullish_sequence_active,
        bearish_sequence_active=seq_state.bearish_sequence_active,
        strong_up_sequence_context=seq_state.strong_up_sequence_context,
        strong_down_sequence_context=seq_state.strong_down_sequence_context,
        up_sequence_count=seq_state.up_sequence_count,
        down_sequence_count=seq_state.down_sequence_count,
        up_sequence_break_bars_ago=seq_state.up_sequence_break_bars_ago,
        down_sequence_break_bars_ago=seq_state.down_sequence_break_bars_ago,
        up_sequence_broke_recently=seq_state.up_sequence_broke_recently,
        down_sequence_broke_recently=seq_state.down_sequence_broke_recently,
        down_sequence_broke_in_strong_up_context=seq_state.down_sequence_broke_in_strong_up_context,
        up_sequence_broke_in_strong_down_context=seq_state.up_sequence_broke_in_strong_down_context,
        buy_signal=seq_state.buy_signal,
        sell_signal=seq_state.sell_signal,
        strong_buy_signal=seq_state.strong_buy_signal,
        strong_sell_signal=seq_state.strong_sell_signal,
        strong_buy_signal_bars_ago=seq_state.strong_buy_signal_bars_ago,
        strong_sell_signal_bars_ago=seq_state.strong_sell_signal_bars_ago,
        # SMA position booleans
        is_above_sma20=_above(last_close, sma20),
        is_below_sma20=_below(last_close, sma20),
        is_above_sma50=_above(last_close, sma50),
        is_below_sma50=_below(last_close, sma50),
        is_above_sma150=_above(last_close, sma150),
        is_below_sma150=_below(last_close, sma150),
        is_above_sma200=_above(last_close, sma200),
        is_below_sma200=_below(last_close, sma200),
    )
