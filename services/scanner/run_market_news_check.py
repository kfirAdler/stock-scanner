#!/usr/bin/env python3
"""CLI entrypoint for the market-news notification job."""

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def main() -> None:
    from src.jobs.check_market_news import run

    result = run()
    if not result.get("stored"):
        print("No market news headline stored.")
        return
    print(
        f"Stored market news headline in {result.get('duration_seconds', 0):.1f}s"
        f" (expired deleted: {result.get('deleted', 0)})."
    )


if __name__ == "__main__":
    main()
