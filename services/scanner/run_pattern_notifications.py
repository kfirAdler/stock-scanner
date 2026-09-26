#!/usr/bin/env python3
"""Send queued pattern alerts without failing the market refresh."""
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from src.jobs.pattern_notifications import send_pending_pattern_alerts

try:
    print(json.dumps(send_pending_pattern_alerts(), indent=2))
except Exception as exc:
    logging.warning("Pattern notification delivery skipped: %s", exc)
