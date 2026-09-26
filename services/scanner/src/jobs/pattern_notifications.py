"""Queue and deliver durable Discord alerts for newly detected patterns."""
from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import re
import time
from datetime import datetime, timezone

import requests
from PIL import Image, ImageDraw, ImageFont

from ..repositories.market_data_repository import _get_client

logger = logging.getLogger(__name__)
CHANNEL_ENV = {
    "ascending_triangle": "DISCORD_PATTERN_ASCENDING_TRIANGLE_CHANNEL_ID",
    "channel": "DISCORD_PATTERN_CHANNEL_CHANNEL_ID",
    "cup_and_handle": "DISCORD_PATTERN_CUP_AND_HANDLE_CHANNEL_ID",
}


def _event_key(row, match):
    identity = "|".join(str(value or "") for value in (
        row.get("ticker"), match.get("pattern"), match.get("channelDirection"), row.get("as_of"),
    ))
    return hashlib.sha256(identity.encode()).hexdigest()


def enqueue_new_pattern_alerts(client, rows):
    alerts = []
    for row in rows:
        for match in row.get("matches", []):
            if match.get("stage") == "developing" or match.get("change") != "new":
                continue
            alerts.append({
                "event_key": _event_key(row, match),
                "ticker": row["ticker"],
                "pattern": match["pattern"],
                "breakout_price": match.get("breakoutLevel"),
                "payload": {
                    "ticker": row["ticker"], "market": row.get("market"),
                    "as_of": row.get("as_of"), "candles": row.get("candles") or [],
                    "match": match,
                },
            })
    if not alerts:
        return 0
    try:
        (client.table("pattern_alert_outbox").upsert(alerts, on_conflict="event_key",
                                                     ignore_duplicates=True).execute())
        return len(alerts)
    except Exception as exc:
        # Pattern publication must continue if the optional notification table
        # has not been migrated yet or Supabase is temporarily unavailable.
        logger.warning("Could not queue %d pattern alerts: %s", len(alerts), exc)
        return 0


def _font(size, bold=False):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def render_pattern_png(payload):
    candles = payload.get("candles") or []
    match = payload["match"]
    if not candles:
        raise ValueError("Pattern alert has no candles")
    width, height = 1200, 675
    left, top, right, bottom = 70, 105, 1150, 590
    image = Image.new("RGB", (width, height), "#0c1713")
    draw = ImageDraw.Draw(image)
    low = min(float(c["low"]) for c in candles)
    high = max(float(c["high"]) for c in candles)
    padding = max((high - low) * .08, high * .001)
    low, high = low - padding, high + padding
    x = lambda index: left + (index + .5) / len(candles) * (right - left)
    y = lambda value: bottom - (float(value) - low) / (high - low) * (bottom - top)
    for fraction in (.25, .5, .75):
        py = top + (bottom - top) * fraction
        draw.line((left, py, right, py), fill="#20342c", width=1)
    candle_width = max(2, int((right - left) / len(candles) * .62))
    for index, candle in enumerate(candles):
        color = "#35d6a1" if float(candle["close"]) >= float(candle["open"]) else "#ef7373"
        px = x(index)
        draw.line((px, y(candle["high"]), px, y(candle["low"])), fill=color, width=2)
        y1, y2 = y(candle["open"]), y(candle["close"])
        draw.rectangle((px - candle_width / 2, min(y1, y2), px + candle_width / 2,
                        max(y1 + 1, y2)), fill=color)
    line_colors = {"support": "#35d6a1", "resistance": "#62a8ff", "guide": "#b794f6"}
    for line in match.get("lines", []):
        draw.line((x(line["x1"]), y(line["y1"]), x(line["x2"]), y(line["y2"])),
                  fill=line_colors.get(line.get("style"), "#f2c66d"), width=4)
    breakout = match.get("breakoutLevel")
    if breakout is not None and low <= float(breakout) <= high:
        py = y(breakout)
        for px in range(left, right, 18):
            draw.line((px, py, min(px + 10, right), py), fill="#f2c66d", width=2)
    label = match.get("patternLabel") or match["pattern"].replace("_", " ").title()
    draw.text((left, 30), f'{payload["ticker"]}  ·  {label}', fill="#f4f7f5", font=_font(34, True))
    if breakout is not None:
        draw.text((right, 42), f"Breakout  {float(breakout):,.2f}", anchor="ra",
                  fill="#f2c66d", font=_font(22, True))
    draw.text((left, 620), f'As of {payload.get("as_of") or "—"}', fill="#8da098", font=_font(16))
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def _channel_id(pattern):
    value = os.getenv(CHANNEL_ENV[pattern], "").strip()
    return value if re.fullmatch(r"[0-9]{17,20}", value) else ""


def _post_alert(token, channel, row, image):
    breakout = row.get("breakout_price")
    price = f"{float(breakout):,.2f}" if breakout is not None else "לא זמין"
    content = f'**{row["ticker"]}**\nמחיר פריצה: `{price}`'
    payload = {
        "content": content,
        "allowed_mentions": {"parse": [], "users": [], "roles": []},
        "attachments": [{"id": 0, "filename": row["ticker"].replace(".", "-") + ".png"}],
        "nonce": str(row["id"]), "enforce_nonce": True,
    }
    endpoint = f"https://discord.com/api/v10/channels/{channel}/messages"
    for attempt in range(3):
        response = requests.post(endpoint, headers={"Authorization": "Bot " + token},
                                 data={"payload_json": json.dumps(payload, ensure_ascii=False)},
                                 files={"files[0]": (payload["attachments"][0]["filename"], image, "image/png")},
                                 timeout=60)
        if response.status_code != 429:
            break
        time.sleep(min(max(float(response.json().get("retry_after", 1)), 1), 30))
    if not 200 <= response.status_code < 300:
        raise RuntimeError(f"Discord HTTP {response.status_code}")
    return response.json()["id"]


def send_pending_pattern_alerts(limit=25):
    token = os.getenv("DISCORD_BOT_TOKEN", "").strip()
    channels = {pattern: _channel_id(pattern) for pattern in CHANNEL_ENV}
    if not token or not all(channels.values()):
        logger.info("Pattern Discord delivery is not configured")
        return {"sent": 0, "failed": 0, "configured": False}
    client = _get_client()
    now = datetime.now(timezone.utc).isoformat()
    response = (client.table("pattern_alert_outbox").select("*").eq("status", "pending")
                .lte("next_attempt_at", now).order("id").limit(limit).execute())
    sent = failed = 0
    for row in response.data or []:
        try:
            image = render_pattern_png(row["payload"])
            message_id = _post_alert(token, channels[row["pattern"]], row, image)
            (client.table("pattern_alert_outbox").update({
                "status": "sent", "sent_at": datetime.now(timezone.utc).isoformat(),
                "discord_message_id": message_id, "last_error": None,
            }).eq("id", row["id"]).execute())
            sent += 1
        except Exception as exc:
            failed += 1
            delay = min(3600, 60 * (2 ** min(int(row.get("attempts") or 0), 5)))
            retry_at = datetime.fromtimestamp(time.time() + delay, timezone.utc).isoformat()
            (client.table("pattern_alert_outbox").update({
                "attempts": int(row.get("attempts") or 0) + 1,
                "next_attempt_at": retry_at, "last_error": str(exc)[:500],
            }).eq("id", row["id"]).execute())
            logger.warning("Pattern alert %s failed: %s", row["id"], exc)
    return {"sent": sent, "failed": failed, "configured": True}
