"""Offline regressions for refresh I/O and interrupted runs."""
from datetime import date, datetime, timedelta, timezone
from unittest.mock import Mock
import pandas as pd
import pytest
from src.jobs import refresh_market_snapshot as job
from src.utils import market_data_fetcher as providers
import run_refresh_metadata as metadata_job

@pytest.fixture
def refresh(monkeypatch):
    today = date.today().isoformat()
    latest = dict(trade_date=today, open=10, high=12, low=9, close=11,
                  volume=100, created_at=f"{today}T00:00:00Z")
    state = {
        "symbol_metadata": [dict(ticker="TEST", company_name="Test")],
        "symbol_indicator_snapshot": [dict(ticker="TEST", timeframe=tf, last_trade_date=today,
            updated_at=f"{today}T01:00:00Z") for tf in job.SNAPSHOT_TIMEFRAMES],
        "symbol_pattern_snapshot": [dict(ticker="TEST", as_of=today,
            status="scanned", updated_at=f"{today}T01:00:00Z")],
    }
    monkeypatch.setattr(job, "get_refresh_rows", lambda table, *_: state[table])
    mocks = {}
    for name in ("log_scan_run", "get_latest_bar", "fetch_bars", "upsert_bars",
                 "enforce_retention", "get_ticker_history_for_timeframe", "upsert_snapshots",
                 "publish_pattern_snapshots", "compute_snapshot"):
        mocks[name] = Mock()
        monkeypatch.setattr(job, name, mocks[name])
    mocks["get_latest_bar"].return_value = latest
    mocks["fetch_bars"].return_value = pd.DataFrame([latest])
    mocks["get_ticker_history_for_timeframe"].return_value = pd.DataFrame([latest])
    monkeypatch.setattr(job.time, "sleep", lambda _: None)
    return state, mocks, latest

def test_unchanged_prices_skip_history_and_writes(refresh):
    _, mocks, _ = refresh
    result = job.run(["TEST"])
    assert result["skipped_unchanged"] == 1
    assert result["status"] == "completed"
    for name in ("get_ticker_history_for_timeframe", "upsert_bars", "upsert_snapshots"):
        mocks[name].assert_not_called()
    assert mocks["publish_pattern_snapshots"].call_args.args[0] == []

def test_same_day_final_close_is_written_and_recomputed(refresh):
    _, mocks, latest = refresh
    mocks["fetch_bars"].return_value = pd.DataFrame([{**latest, "close": 11.5}])
    result = job.run(["TEST"])
    assert result["skipped_unchanged"] == 0
    assert mocks["upsert_bars"].call_args.args[1].iloc[0]["close"] == 11.5
    mocks["get_ticker_history_for_timeframe"].assert_called_once()
    assert mocks["fetch_bars"].call_args.args[1] == date.today()

@pytest.mark.parametrize("damage", ["missing_pattern", "stale_pattern", "missing_indicator", "old_timestamp", "force"])
def test_recovers_missing_or_outdated_publication(refresh, damage):
    state, mocks, latest = refresh
    if damage == "missing_pattern":
        state["symbol_pattern_snapshot"] = []
    elif damage == "stale_pattern":
        state["symbol_pattern_snapshot"][0]["status"] = "stale"
    elif damage == "missing_indicator":
        state["symbol_indicator_snapshot"].pop()
    elif damage == "old_timestamp":
        latest["created_at"] = f"{date.today()}T02:00:00Z"
    result = job.run(["TEST"], force_recompute=damage == "force")
    assert result["status"] == "completed"
    mocks["upsert_bars"].assert_not_called()
    mocks["get_ticker_history_for_timeframe"].assert_called_once()
    assert len(mocks["publish_pattern_snapshots"].call_args.args[0]) == 1

def test_empty_provider_response_preserves_existing_data_as_unavailable(refresh):
    _, mocks, latest = refresh
    mocks["fetch_bars"].side_effect = [None] + [pd.DataFrame([latest])] * 10
    result = job.run(["TEST"] + [f"OK{i}" for i in range(10)])
    assert result["status"] == "completed"
    assert result["failed"] == 0
    assert result["processed"] == 11
    assert result["skipped_unavailable"] == 1
    mocks["upsert_bars"].assert_not_called()

def test_provider_wide_empty_response_still_fails(refresh):
    _, mocks, _ = refresh
    mocks["fetch_bars"].return_value = None
    result = job.run(["TEST"])
    assert result["status"] == "completed_with_errors"
    assert "provider-wide outage" in result["provider_error"]

def test_empty_provider_response_without_stored_data_still_fails(refresh):
    _, mocks, _ = refresh
    mocks["get_latest_bar"].return_value = None
    mocks["fetch_bars"].return_value = None
    result = job.run(["TEST"])
    assert result["status"] == "completed_with_errors"
    assert result["failed"] == 1

def test_pattern_failure_is_reported(refresh):
    state, mocks, _ = refresh
    state["symbol_pattern_snapshot"] = []
    mocks["publish_pattern_snapshots"].side_effect = RuntimeError("offline")
    result = job.run(["TEST"])
    assert result["status"] == "completed_with_errors"
    assert result["pattern_error"] == "offline"

def test_changed_bars_filters_old_identical_and_invalid_rows():
    last = dict(trade_date="2026-09-22", open=1, high=2, low=1, close=2, volume=10)
    frame = pd.DataFrame([last, {**last, "trade_date": "2026-09-21"},
        {**last, "trade_date": "2026-09-23", "volume": None},
        {**last, "trade_date": "2026-09-24", "close": None}])
    result = job.changed_bars(frame, last)
    assert list(result.trade_date) == ["2026-09-23"]
    assert result.iloc[0].volume == 0

def test_yahoo_success_never_calls_stooq(monkeypatch):
    providers.reset_provider_circuit()
    bars = pd.DataFrame([{"close": 10}])
    monkeypatch.setattr(providers, "fetch_bars_yfinance", Mock(return_value=bars))
    stooq = Mock()
    monkeypatch.setattr(providers, "fetch_bars_stooq", stooq)
    assert providers.fetch_bars("TEST", date.today(), date.today()) is bars
    stooq.assert_not_called()

def test_stooq_circuit_stops_failures_but_yahoo_keeps_running(monkeypatch):
    providers.reset_provider_circuit()
    yahoo, stooq = Mock(return_value=None), Mock(return_value=None)
    monkeypatch.setattr(providers, "fetch_bars_yfinance", yahoo)
    monkeypatch.setattr(providers, "fetch_bars_stooq", stooq)
    for _ in range(10):
        assert providers.fetch_bars("TEST", date.today(), date.today()) is None
    assert yahoo.call_count == 10
    assert stooq.call_count == 3
    providers.reset_provider_circuit()

def test_metadata_skips_recent_and_records_empty_lookups(monkeypatch):
    today = datetime.now(timezone.utc).date()
    monkeypatch.setattr(metadata_job, "get_refresh_rows", lambda *_: [
        dict(ticker="FRESH", updated_at=today.isoformat()),
        dict(ticker="STALE", updated_at=(today - timedelta(days=8)).isoformat())])
    fetch = Mock(side_effect=[{"company_name": "Old"}, {"company_name": None}])
    write = Mock()
    checked = Mock()
    monkeypatch.setattr(metadata_job, "fetch_symbol_metadata_yfinance", fetch)
    monkeypatch.setattr(metadata_job, "upsert_symbol_metadata", write)
    monkeypatch.setattr(metadata_job, "upsert_symbol_market", checked)
    assert metadata_job.run(["FRESH", "STALE", "EMPTY"]) == 0
    assert fetch.call_count == 2
    write.assert_called_once_with("STALE", market="US", company_name="Old")
    checked.assert_called_once_with("EMPTY", "US")


def test_metadata_real_error_still_fails_job(monkeypatch):
    monkeypatch.setattr(metadata_job, "get_refresh_rows", lambda *_: [])
    monkeypatch.setattr(metadata_job, "fetch_symbol_metadata_yfinance",
                        Mock(side_effect=RuntimeError("unexpected")))
    assert metadata_job.run(["BROKEN"]) == 1

def test_patterns_are_published_in_restartable_batches(refresh):
    _, mocks, _ = refresh
    result = job.run([f"T{i:02}" for i in range(51)], force_recompute=True)
    assert result["processed"] == 51
    assert [len(call.args[0]) for call in mocks["publish_pattern_snapshots"].call_args_list] == [50, 1]


def test_cli_exits_nonzero_for_pattern_only_failure(monkeypatch):
    import run_refresh
    monkeypatch.setattr("sys.argv", ["run_refresh.py", "--tickers", "TEST"])
    monkeypatch.setattr(job, "run", Mock(return_value={
        "status": "completed_with_errors", "failed": 0, "pattern_error": "offline"}))
    with pytest.raises(SystemExit) as exc:
        run_refresh.main()
    assert exc.value.code == 1
