"""Alert checking job: diff current scan results against last known ticker set."""

import logging
from datetime import datetime, timezone

from ..repositories.market_data_repository import _get_client

logger = logging.getLogger(__name__)

MAX_NOTIFICATIONS_PER_SCREEN = 10
SCREENER_LIMIT = 500


def run() -> dict:
    started_at = datetime.now(timezone.utc)
    logger.info("Starting check_alerts at %s", started_at.isoformat())

    client = _get_client()

    result = (
        client.table("screen_alerts")
        .select("id, user_id, saved_screen_id, last_tickers, saved_screens(name, filter_json)")
        .eq("enabled", True)
        .execute()
    )

    alerts = result.data or []
    if not alerts:
        logger.info("No active alerts found.")
        return {"checked": 0, "triggered": 0}

    logger.info("Found %d active alert(s) to check.", len(alerts))

    checked = 0
    triggered = 0

    for alert in alerts:
        alert_id = alert["id"]
        user_id = alert["user_id"]
        saved_screen_id = alert["saved_screen_id"]
        stored_tickers = alert.get("last_tickers")
        screen = alert.get("saved_screens") or {}
        screen_name = screen.get("name") or "Unnamed Screen"
        filter_json = screen.get("filter_json")

        if not filter_json:
            logger.warning("Alert %s: no filter_json on saved screen, skipping.", alert_id)
            continue

        try:
            rpc_result = client.rpc(
                "run_screener_v1",
                {
                    "payload": filter_json,
                    "result_limit": SCREENER_LIMIT,
                    "result_offset": 0,
                    "sort_key": "ticker",
                    "sort_dir": "asc",
                },
            ).execute()

            rows = rpc_result.data or []
            current_tickers = sorted({row["ticker"] for row in rows if "ticker" in row})
            current_set = set(current_tickers)

            checked += 1

            if stored_tickers is None:
                # First run after enabling — store baseline, no notification
                logger.info(
                    "Alert %s: first run, storing %d tickers without notifying.",
                    alert_id, len(current_tickers),
                )
            else:
                last_set = set(stored_tickers)
                new_entries = sorted(current_set - last_set)

                if new_entries:
                    logger.info(
                        "Alert %s (%s): %d new ticker(s): %s",
                        alert_id, screen_name, len(new_entries), ", ".join(new_entries),
                    )

                    client.table("alert_notifications").insert({
                        "user_id": user_id,
                        "saved_screen_id": saved_screen_id,
                        "screen_name": screen_name,
                        "new_tickers": new_entries,
                    }).execute()

                    # Prune to MAX_NOTIFICATIONS_PER_SCREEN per (user, screen)
                    all_notifs = (
                        client.table("alert_notifications")
                        .select("id")
                        .eq("user_id", user_id)
                        .eq("saved_screen_id", saved_screen_id)
                        .order("triggered_at", desc=True)
                        .execute()
                    )
                    ids = [r["id"] for r in (all_notifs.data or [])]
                    if len(ids) > MAX_NOTIFICATIONS_PER_SCREEN:
                        client.table("alert_notifications").delete().in_(
                            "id", ids[MAX_NOTIFICATIONS_PER_SCREEN:]
                        ).execute()

                    triggered += 1
                else:
                    logger.info("Alert %s (%s): no new tickers.", alert_id, screen_name)

            client.table("screen_alerts").update({
                "last_tickers": current_tickers,
                "last_checked_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", alert_id).execute()

        except Exception:
            logger.exception("Failed to process alert %s", alert_id)

    finished_at = datetime.now(timezone.utc)
    summary = {
        "checked": checked,
        "triggered": triggered,
        "duration_seconds": (finished_at - started_at).total_seconds(),
    }
    logger.info("Alert check finished: %s", summary)
    return summary
