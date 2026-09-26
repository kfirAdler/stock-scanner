from io import BytesIO
from unittest.mock import Mock

from PIL import Image

from src.jobs.pattern_notifications import enqueue_new_pattern_alerts, render_pattern_png


def payload(change="new", stage=None):
    candles = [
        {"date": f"2026-09-{day:02}", "open": 100 + day, "high": 103 + day,
         "low": 99 + day, "close": 102 + day}
        for day in range(1, 21)
    ]
    match = {
        "pattern": "ascending_triangle", "patternLabel": "Ascending triangle",
        "confidence": .86, "change": change, "breakoutLevel": 123.4,
        "invalidationLevel": 112.0,
        "lines": [{"x1": 1, "y1": 104, "x2": 19, "y2": 123.4,
                   "style": "resistance"}],
    }
    if stage:
        match["stage"] = stage
    return {"ticker": "TEST", "market": "US", "as_of": "2026-09-20",
            "candles": candles, "matches": [match]}


def test_only_new_strict_patterns_are_queued():
    execute = Mock(return_value=Mock(data=[]))
    builder = Mock()
    builder.upsert.return_value.execute = execute
    client = Mock()
    client.table.return_value = builder
    rows = [payload(), payload(change="stable"), payload(stage="developing")]
    assert enqueue_new_pattern_alerts(client, rows) == 1
    queued = builder.upsert.call_args.args[0]
    assert len(queued) == 1
    assert queued[0]["ticker"] == "TEST"
    assert queued[0]["breakout_price"] == 123.4


def test_pattern_chart_is_a_discord_ready_png():
    row = payload()
    image = Image.open(BytesIO(render_pattern_png({
        **{key: row[key] for key in ("ticker", "market", "as_of", "candles")},
        "match": row["matches"][0],
    })))
    assert image.format == "PNG"
    assert image.size == (1200, 675)
