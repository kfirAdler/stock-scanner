#!/usr/bin/env python3
"""Insert a manual global market-news notification for testing."""

from __future__ import annotations

import argparse
import logging
from datetime import datetime, timedelta, timezone

from src.repositories.market_data_repository import _get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger("seed_market_news_notification")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed a manual global market-news notification"
    )
    parser.add_argument(
        "--headline",
        default="S&P 500 rises as traders react to a fresh market catalyst",
        help="Headline text to show in the notification bell",
    )
    parser.add_argument(
        "--source",
        default="Manual test",
        help="Source label shown under the headline",
    )
    parser.add_argument(
        "--url",
        default="https://example.com/market-news-demo",
        help="Optional article URL",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=2,
        help="TTL in days before the notification expires",
    )
    parser.add_argument(
        "--kind",
        default="manual_demo_news",
        help="Kind key so test inserts do not collide with daily_top_news",
    )
    parser.add_argument(
        "--slot",
        type=int,
        default=1,
        help="Slot number for the headline within the day (1 or 2)",
    )
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    payload = {
        "kind": args.kind,
        "slot": max(args.slot, 1),
        "market_date": now.date().isoformat(),
        "headline": args.headline,
        "source": args.source,
        "url": args.url,
        "published_at": now.isoformat(),
        "expires_at": (now + timedelta(days=max(args.days, 1))).isoformat(),
        "updated_at": now.isoformat(),
    }

    client = _get_client()
    result = (
        client.table("global_market_notifications")
        .upsert(payload, on_conflict="kind,market_date,slot")
        .execute()
    )

    rows = result.data or []
    logger.info("Seeded %d manual market-news row(s)", len(rows))
    print("Inserted manual market-news notification:")
    print(f"headline: {args.headline}")
    print(f"source: {args.source}")
    print(f"slot: {payload['slot']}")
    print(f"expires_at: {payload['expires_at']}")


if __name__ == "__main__":
    main()
