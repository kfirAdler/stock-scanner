"""Run the original JS detectors once on histories already loaded by refresh."""
import json
import subprocess
from pathlib import Path

from ..repositories.market_data_repository import _get_client, chunk_rows
from .pattern_notifications import enqueue_new_pattern_alerts


def _match_key(match):
    return (match.get("pattern"), match.get("channelDirection"), match.get("stage"))


def annotate_match_changes(rows, previous_rows):
    """Label current matches by how they changed since the prior snapshot."""
    previous = {row["ticker"]: row.get("matches") or [] for row in previous_rows}
    for row in rows:
        old = {_match_key(match): match for match in previous.get(row["ticker"], [])}
        for match in row.get("matches", []):
            prior = old.get(_match_key(match))
            if prior is None:
                match["change"] = "new"
                continue
            before = float(prior.get("confidence") or 0)
            after = float(match.get("confidence") or 0)
            match["previousConfidence"] = before
            match["change"] = (
                "strengthened" if after - before >= 0.03
                else "weakened" if before - after >= 0.03
                else "stable"
            )
    return rows


def pattern_input(ticker, history, company_name=None):
    candles = []
    if not history.empty:
        for row in history.sort_values("trade_date").tail(160).to_dict("records"):
            try:
                candles.append({"date": str(row["trade_date"])[:10], **{
                    key: float(row[key]) for key in ("open", "high", "low", "close")
                }})
            except (TypeError, ValueError, KeyError):
                continue
    # Pandas can contain NaN; JSON must remain valid for the JS runner.
    import math
    candles = [c for c in candles if all(math.isfinite(c[k]) for k in ("open", "high", "low", "close"))]
    return {"ticker": ticker, "candles": candles, "company_name": company_name}


def publish_pattern_snapshots(series):
    if not series:
        return 0
    runner = Path(__file__).resolve().parents[2] / "patterns" / "scan.mjs"
    result = subprocess.run(
        ["node", str(runner.resolve())], input=json.dumps(series, allow_nan=False),
        text=True, capture_output=True, check=True, timeout=120,
    )
    rows = json.loads(result.stdout)
    client = _get_client()
    previous_rows = []
    for ticker_batch in chunk_rows([row["ticker"] for row in rows], batch_size=50):
        response = (client.table("symbol_pattern_snapshot")
                    .select("ticker,matches").in_("ticker", ticker_batch).execute())
        previous_rows.extend(response.data or [])
    annotate_match_changes(rows, previous_rows)
    enqueue_new_pattern_alerts(client, rows)
    for batch in chunk_rows(rows, batch_size=50):
        client.table("symbol_pattern_snapshot").upsert(batch, on_conflict="ticker").execute()
    return len(rows)
