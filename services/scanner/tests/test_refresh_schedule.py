"""Scheduled duplicate runs must not repeat full-universe database work."""

from unittest.mock import patch

from src.jobs import refresh_market_snapshot as refresh


def test_recent_full_scan_skips_all_ticker_reads_and_writes():
    with (
        patch.object(refresh, "tickers_for_refresh_universe", return_value=["AAPL", "MSFT"]),
        patch.object(refresh, "has_recent_full_scan", return_value=True) as recent,
        patch.object(refresh, "log_scan_run") as log,
        patch.object(refresh, "get_latest_trade_date") as history,
        patch.object(refresh, "publish_pattern_snapshots") as patterns,
    ):
        result = refresh.run(universe="all", skip_if_recent_full_minutes=50)

    assert result["status"] == "skipped_recent"
    assert result["failed"] == 0
    recent.assert_called_once()
    log.assert_not_called()
    history.assert_not_called()
    patterns.assert_not_called()
