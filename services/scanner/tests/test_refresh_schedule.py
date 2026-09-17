"""Scheduled duplicate runs must not repeat full-universe database work."""

import sys
from unittest.mock import patch

import pytest

import run_refresh
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


@pytest.mark.parametrize(
    ("status", "pattern_error", "exit_code", "did_scan"),
    [
        ("skipped_recent", None, 0, "false"),
        ("completed_with_errors", "pattern publish failed", 1, "true"),
    ],
)
def test_action_reports_scan_outcome(tmp_path, monkeypatch, status, pattern_error, exit_code, did_scan):
    output = tmp_path / "output"
    summary = tmp_path / "summary"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    monkeypatch.setattr(sys, "argv", ["run_refresh.py", "--universe", "all"])
    result = {
        "status": status,
        "total": 629,
        "processed": 0 if status == "skipped_recent" else 629,
        "failed": 0,
        "pattern_error": pattern_error,
    }
    with patch.object(refresh, "run", return_value=result):
        with pytest.raises(SystemExit) as exc:
            run_refresh.main()

    assert exc.value.code == exit_code
    assert output.read_text() == f"did_scan={did_scan}\n"
    assert f"Stocks processed: {result['processed']} / 629" in summary.read_text()
    if pattern_error:
        assert "Pattern snapshots: failed" in summary.read_text()
