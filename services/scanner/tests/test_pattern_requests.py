"""Offline worker tests. Supabase calls are mocked; the real Node detector runs."""
import math
import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

from src.jobs import process_pattern_requests as worker


def series(ticker):
    candles = []
    for index in range(160):
        close = 100 + index * 0.15 + 3 * math.sin(index * math.pi / 10)
        candles.append({
            "date": (date.today() - timedelta(days=159 - index)).isoformat(),
            "open": close - 0.1, "high": close + 0.5,
            "low": close - 0.5, "close": close,
        })
    return {"ticker": ticker, "company_name": ticker, "candles": candles}


class PatternWorkerTests(unittest.TestCase):
    def test_scans_multiple_batches_with_only_the_requested_detector(self):
        first = [series(f"T{i:02}") for i in range(20)]
        second = [series("T20")]
        with patch.object(worker, "read_batch", side_effect=[first, second, []]) as read:
            result = worker.scan_job(Mock(), {"market": "US", "pattern": "channel"})
        self.assertEqual(result["coverage"]["total"], 21)
        self.assertEqual(result["coverage"]["scanned"], 21)
        self.assertEqual(len(result["rows"]), 21)
        self.assertTrue(all(row["matches"][0]["pattern"] == "channel" for row in result["rows"]))
        self.assertEqual([call.args[2] for call in read.call_args_list], ["", "T19", "T20"])

    def test_no_fallback_when_selected_pattern_does_not_match(self):
        with patch.object(worker, "read_batch", side_effect=[[series("CHANNEL")], []]):
            result = worker.scan_job(Mock(), {"market": "US", "pattern": "ascending_triangle"})
        self.assertEqual(result["coverage"]["scanned"], 1)
        self.assertEqual(result["rows"], [])

    def test_developing_results_keep_diagnostics_and_candles(self):
        candidate = series("NEAR")
        candidate["candles"][-1]["high"] = 130
        with patch.object(worker, "read_batch", side_effect=[[candidate], []]):
            result = worker.scan_job(Mock(), {"market": "US", "pattern": "channel"})
        self.assertEqual(result["diagnostics"]["strictMatches"], 0)
        self.assertEqual(result["diagnostics"]["developingSetups"], 1)
        self.assertEqual(result["diagnostics"]["rejected"], {"upper_breach": 1})
        self.assertEqual(result["rows"][0]["matches"], [])
        self.assertEqual(len(result["rows"][0]["candles"]), 160)
        self.assertEqual(len(result["rows"][0]["preview"]["candles"]), 48)

    def test_empty_universe_is_reported_as_failure(self):
        with patch.object(worker, "read_batch", return_value=[]):
            with self.assertRaisesRegex(ValueError, "No symbol metadata"):
                worker.scan_job(Mock(), {"market": "US", "pattern": "channel"})

    def test_reads_retry_transient_errors_only_three_times(self):
        client = Mock()
        client.rpc.return_value.execute.side_effect = [RuntimeError("temporary"), RuntimeError("temporary"), SimpleNamespace(data=[])]
        with patch.object(worker.time, "sleep") as sleep:
            self.assertEqual(worker.read_batch(client, "US", ""), [])
        self.assertEqual(client.rpc.call_count, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1, 2])

    def test_failed_job_is_finished_without_publishing_partial_results(self):
        client = Mock()
        job = {"id": "job", "leaseId": "lease", "market": "US", "pattern": "channel"}
        client.rpc.return_value.execute.side_effect = [SimpleNamespace(data=job), SimpleNamespace(data=True), SimpleNamespace(data=None)]
        with patch.object(worker, "_get_client", return_value=client), patch.object(worker, "scan_job", side_effect=ValueError("bad history")), patch.object(worker.logger, "exception"):
            self.assertEqual(worker.run(), {"completed": 0, "failed": 1})
        self.assertEqual(client.rpc.call_args_list[1].args, ("finish_pattern_scan", {"p_job_id": "job", "p_lease_id": "lease", "p_result": None}))


if __name__ == "__main__":
    unittest.main()
