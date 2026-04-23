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
        help="Specific tickers to refresh (default: all from DB)",
    )
    args = parser.parse_args()

    from src.jobs.refresh_market_snapshot import run

    result = run(tickers=args.tickers if args.tickers else None)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
