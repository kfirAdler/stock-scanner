#!/usr/bin/env python3
"""CLI entrypoint for the market snapshot refresh job."""

import argparse
import json
import logging
import os
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

    status = result["status"]
    did_scan = status != "skipped_recent"
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        outcome = "Skipped: a full scan started recently" if not did_scan else status.replace("_", " ").capitalize()
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write(
                "### Market refresh\n\n"
                f"- Outcome: {outcome}\n"
                f"- Stocks processed: {result['processed']} / {result['total']}\n"
                f"- Stocks failed: {result['failed']}\n"
            )
            if result.get("pattern_error"):
                summary.write("- Pattern snapshots: failed (see job log)\n")

    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a", encoding="utf-8") as output:
            output.write(f"did_scan={'true' if did_scan else 'false'}\n")

    sys.exit(0 if status in ("completed", "skipped_recent") else 1)


if __name__ == "__main__":
    main()
