#!/usr/bin/env python3
"""CLI entrypoint for the alert-check job."""

import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def main() -> None:
    from src.jobs.check_alerts import run

    result = run()
    checked = result.get("checked", 0)
    triggered = result.get("triggered", 0)
    duration = result.get("duration_seconds", 0)

    if checked == 0:
        print("No active alerts to check.")
    else:
        print(
            f"Checked {checked} alert(s), triggered {triggered} notification(s) "
            f"in {duration:.1f}s."
        )


if __name__ == "__main__":
    main()
