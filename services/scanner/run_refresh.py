#!/usr/bin/env python3
"""CLI entrypoint for the market snapshot refresh job."""

import argparse
import json
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def main():
    parser = argparse.ArgumentParser(description="Refresh market snapshot")
    parser.add_argument(
        "--tickers",
        nargs="*",
        help="Specific tickers to refresh (overrides --universe)",
    )
    parser.add_argument(
        "--universe",
        choices=("all", "us", "ta"),
        default="all",
        help="Which index universe to refresh when --tickers is omitted (default: all)",
    )
    parser.add_argument(
        "--skip-if-recent-full-minutes",
        type=int,
        default=0,
        help="Skip a full-universe refresh if one began within this many minutes",
    )
    args = parser.parse_args()

    from src.jobs.refresh_market_snapshot import run

    if args.tickers:
        result = run(tickers=args.tickers)
    else:
        result = run(
            universe=args.universe,
            skip_if_recent_full_minutes=max(0, args.skip_if_recent_full_minutes),
        )
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
