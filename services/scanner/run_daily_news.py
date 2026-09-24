#!/usr/bin/env python3
"""Generate a market digest locally, explicitly send it, or run the 15:00 service."""
import argparse
import logging
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    from dotenv import load_dotenv
    load_dotenv(ROOT.parents[1] / '.env.local')
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--send', action='store_true', help='Send today\'s digest to the configured Discord webhook')
    mode.add_argument('--daemon', action='store_true', help='Run daily at 15:00 Asia/Jerusalem; sends to Discord')
    mode.add_argument('--demo', action='store_true', help='Render offline sample content; never sends')
    parser.add_argument('--scheduled', action='store_true', help='Use the 24 hours ending today at 15:00 Israel time')
    parser.add_argument('--html-only', action='store_true', help='Skip PNG rendering')
    parser.add_argument('--output', type=Path, default=ROOT / 'daily-news-output')
    parser.add_argument('--state', type=Path, default=ROOT / 'daily-news-state')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    from src.daily_news.job import daemon, run
    if args.daemon:
        daemon(args.output, args.state, images=not args.html_only)
    else:
        cutoff = None
        if args.scheduled:
            from datetime import datetime, timezone
            from src.daily_news.job import scheduled_cutoff
            cutoff = scheduled_cutoff(datetime.now(timezone.utc))
            if cutoff is None:
                raise ValueError('Scheduled run cannot execute before 15:00 Israel time')
        paths = run(
            args.output,
            args.state,
            send=args.send,
            demo=args.demo,
            images=not args.html_only,
            cutoff=cutoff,
            scheduled=args.scheduled,
        )
        for path in paths:
            print(path)


if __name__ == '__main__':
    main()
