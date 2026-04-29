from dataclasses import dataclass
from typing import Optional

from ..signals.sequence import SequenceState


@dataclass
class FibonacciState:
    swing_side: Optional[str] = None
    swing_low: Optional[float] = None
    swing_high: Optional[float] = None
    level_382: Optional[float] = None
    level_500: Optional[float] = None
    level_618: Optional[float] = None
    level_786: Optional[float] = None
    zone_0_382: bool = False
    zone_382_500: bool = False
    zone_500_618: bool = False
    zone_618_786: bool = False
    zone_786_100: bool = False


def _between(value: float, a: float, b: float) -> bool:
    lo = min(a, b)
    hi = max(a, b)
    return lo <= value <= hi


def compute_fibonacci_state(
    sequence_state: SequenceState, close: float
) -> FibonacciState:
    swing_side = sequence_state.last_completed_sequence_side
    swing_low = sequence_state.last_completed_sequence_low
    swing_high = sequence_state.last_completed_sequence_high

    if (
        swing_side not in {"up", "down"}
        or swing_low is None
        or swing_high is None
        or swing_high <= swing_low
    ):
        return FibonacciState()

    price_range = swing_high - swing_low
    if swing_side == "up":
        level_382 = swing_high - (price_range * 0.382)
        level_500 = swing_high - (price_range * 0.5)
        level_618 = swing_high - (price_range * 0.618)
        level_786 = swing_high - (price_range * 0.786)
        return FibonacciState(
            swing_side=swing_side,
            swing_low=swing_low,
            swing_high=swing_high,
            level_382=level_382,
            level_500=level_500,
            level_618=level_618,
            level_786=level_786,
            zone_0_382=_between(close, level_382, swing_high),
            zone_382_500=_between(close, level_500, level_382),
            zone_500_618=_between(close, level_618, level_500),
            zone_618_786=_between(close, level_786, level_618),
            zone_786_100=_between(close, swing_low, level_786),
        )

    level_382 = swing_low + (price_range * 0.382)
    level_500 = swing_low + (price_range * 0.5)
    level_618 = swing_low + (price_range * 0.618)
    level_786 = swing_low + (price_range * 0.786)
    return FibonacciState(
        swing_side=swing_side,
        swing_low=swing_low,
        swing_high=swing_high,
        level_382=level_382,
        level_500=level_500,
        level_618=level_618,
        level_786=level_786,
        zone_0_382=_between(close, swing_low, level_382),
        zone_382_500=_between(close, level_382, level_500),
        zone_500_618=_between(close, level_500, level_618),
        zone_618_786=_between(close, level_618, level_786),
        zone_786_100=_between(close, level_786, swing_high),
    )
