"""Drain shared single-pattern searches without refreshing prices or other indicators."""
import json
import logging
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path


logger = logging.getLogger(__name__)
RUNNER = Path(__file__).resolve().parents[2] / "patterns" / "scan.mjs"


def _get_client():
    # Keep pure worker/detector tests independent of Supabase dependencies.
    from ..repositories.market_data_repository import _get_client as get_client
    return get_client()


def read_batch(client, market, cursor):
    for attempt in range(3):
        try:
            return client.rpc("pattern_scan_series", {
                "p_market": market, "p_after": cursor, "p_batch_size": 20,
            }).execute().data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def scan_job(client, job):
    cursor = ""
    matches = []
    coverage = {"total": 0, "scanned": 0, "stale": 0, "insufficient": 0}
    deadline = time.monotonic() + 15 * 60
    while True:
        if time.monotonic() > deadline:
            raise TimeoutError("Pattern search exceeded its processing window")
        batch = read_batch(client, job["market"], cursor)
        if not batch:
            break
        # No shell, no server process, and only the explicitly selected detector.
        output = subprocess.run(
            ["node", str(RUNNER)],
            input=json.dumps({"series": batch, "pattern": job["pattern"]}, allow_nan=False),
            text=True, capture_output=True, check=True, timeout=60,
        )
        rows = json.loads(output.stdout)
        for row in rows:
            coverage["total"] += 1
            key = "insufficient" if row["status"] == "insufficient_history" else row["status"]
            coverage[key] += 1
            if row["matches"]:
                matches.append(row)
        next_cursor = batch[-1]["ticker"]
        if next_cursor <= cursor:
            raise ValueError("Pattern history pagination did not advance")
        cursor = next_cursor
    if coverage["total"] == 0:
        raise ValueError("No symbol metadata available for the requested market")
    return {"rows": matches, "coverage": coverage, "updatedAt": datetime.now(timezone.utc).isoformat()}


def run(max_jobs=6):
    client = _get_client()
    completed = failed = 0
    for _ in range(max_jobs):
        job = client.rpc("claim_pattern_scan", {}).execute().data
        if not job:
            break
        try:
            result = scan_job(client, job)
            saved = client.rpc("finish_pattern_scan", {
                "p_job_id": job["id"], "p_lease_id": job["leaseId"], "p_result": result,
            }).execute().data
            if not saved:
                raise RuntimeError("Pattern scan lease expired; result was not published")
            completed += 1
        except Exception:
            failed += 1
            logger.exception("Pattern search failed for job %s", job["id"])
            # Lost workers retry through an expiring lease. Reported failures
            # remain visible to the requester; their cooldown persists.
            client.rpc("finish_pattern_scan", {
                "p_job_id": job["id"], "p_lease_id": job["leaseId"], "p_result": None,
            }).execute()
    return {"completed": completed, "failed": failed}
