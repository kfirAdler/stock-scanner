"""Fetch one market-wide headline and store it as a global notification."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from xml.etree import ElementTree

import requests

from ..repositories.market_data_repository import _get_client

logger = logging.getLogger(__name__)

MARKET_NEWS_KIND = "daily_top_news"
MARKET_NEWS_RSS_URL = (
    "https://news.google.com/rss/search"
    "?q=stock%20market%20when%3A1d&hl=en-US&gl=US&ceid=US:en"
)
RSS_TIMEOUT_SECONDS = 15
TTL_DAYS = 2


def _parse_pub_date(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        logger.warning("Could not parse pubDate %r, using now()", value)
        return datetime.now(timezone.utc)


def _strip_google_redirect(url: str | None) -> str | None:
    if not url:
        return None
    return url.strip() or None


def _extract_leading_text(text: str | None) -> str | None:
    if not text:
        return None
    value = text.strip()
    return value or None


def fetch_top_market_headline() -> dict[str, Any] | None:
    response = requests.get(MARKET_NEWS_RSS_URL, timeout=RSS_TIMEOUT_SECONDS)
    response.raise_for_status()

    root = ElementTree.fromstring(response.content)
    channel = root.find("channel")
    if channel is None:
        raise ValueError("RSS feed missing channel")

    item = channel.find("item")
    if item is None:
        return None

    title = _extract_leading_text(item.findtext("title"))
    link = _strip_google_redirect(item.findtext("link"))
    pub_date = _parse_pub_date(item.findtext("pubDate"))

    source_text = None
    source_node = item.find("source")
    if source_node is not None:
        source_text = _extract_leading_text(source_node.text)
    if not source_text and title and " - " in title:
        title, source_text = [part.strip() for part in title.rsplit(" - ", 1)]

    if not title:
        return None

    return {
        "kind": MARKET_NEWS_KIND,
        "market_date": pub_date.date().isoformat(),
        "headline": title,
        "source": source_text,
        "url": link,
        "published_at": pub_date.isoformat(),
        "expires_at": (pub_date + timedelta(days=TTL_DAYS)).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def cleanup_expired_market_news() -> int:
    client = _get_client()
    result = (
        client.table("global_market_notifications")
        .delete()
        .lte("expires_at", datetime.now(timezone.utc).isoformat())
        .execute()
    )
    return len(result.data or [])


def run() -> dict[str, Any]:
    started_at = datetime.now(timezone.utc)
    deleted = cleanup_expired_market_news()

    payload = fetch_top_market_headline()
    if not payload:
        logger.info("No market headline found.")
        return {
            "stored": False,
            "deleted": deleted,
            "duration_seconds": (datetime.now(timezone.utc) - started_at).total_seconds(),
        }

    client = _get_client()
    result = (
        client.table("global_market_notifications")
        .upsert(payload, on_conflict="kind,market_date")
        .execute()
    )

    stored = bool(result.data)
    summary = {
        "stored": stored,
        "deleted": deleted,
        "headline": payload["headline"],
        "duration_seconds": (datetime.now(timezone.utc) - started_at).total_seconds(),
    }
    logger.info("Market news check finished: %s", summary)
    return summary
