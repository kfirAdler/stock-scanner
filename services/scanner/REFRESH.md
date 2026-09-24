# Intraday stock refresh

The GitHub workflow runs every weekday at **10:02, 11:02, 12:02, 13:02,
14:02, 15:02, and 16:02 America/New_York**. This is the first top-of-hour slot
after the 09:30 US market open through the closing bar, and the named timezone
keeps it aligned across US daylight-saving changes. It updates the S&P 500 and
TA-125 daily bars, derived weekly/monthly indicators, patterns, alerts, and the
market-news headline.

Price downloads use Yahoo first. Stooq is a fallback with short connection/read
timeouts and is disabled for the rest of a run after three failed or empty
responses. The most recent stored candle is fetched again to capture its final
close and volume. Only changed/new bars are written.

The refresh reads small snapshot-state records in batches. When prices are
unchanged and all indicator/pattern snapshots are current, it skips history
downloads from Supabase and snapshot writes. Publication timestamps detect a
previous run interrupted after updating a candle. Missing or stale snapshots
are rebuilt; patterns publish in batches of 50 so progress survives cancellation.
Full history remains available for indicator calculations when a rebuild is needed.

Company metadata runs in a separate scheduled step with a seven-day refresh
cooldown. Empty Yahoo profiles are recorded as checked and logged as warnings,
without deleting existing metadata or failing the workflow. This avoids querying
unsupported symbols on every run while allowing them to be retried later.

From `services/scanner`, targeted recovery is available with:

```sh
python run_refresh.py --tickers AAPL MSFT
python run_refresh.py --tickers AAPL --force-recompute
python run_refresh_metadata.py --tickers AAPL MSFT
```

Manual workflow dispatch also exposes `force_recompute`; use it after changes to
indicator/detector logic that should rebuild unchanged prices.

The price step has a 45-minute limit, metadata 10 minutes, and the whole job
60 minutes. These are cost guardrails, not measured runtime guarantees. The next
production run should be checked for duration, provider failures,
`skipped_unchanged`, and successful completion of pattern publication. Compare
Supabase Database Health disk I/O before and after rollout; HTTP request counts
alone do not measure physical disk I/O. A failed run exits nonzero, including
failures limited to pattern publication.
