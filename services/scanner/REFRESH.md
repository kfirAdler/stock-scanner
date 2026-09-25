# Intraday stock refresh

The GitHub workflow targets one successful refresh per weekday hour from
**10:00 through 16:59 America/New_York**. Because GitHub cron is best effort,
each hour has attempts at minutes **12, 27, 42, and 57**. Before doing any
checkout or setup, each attempt checks completed workflow runs and becomes a
no-op when that New York hour already has a success. A failed or dropped first
attempt can therefore be recovered by a later attempt without refreshing four
times. Delayed triggers that arrive outside the refresh window are ignored.
The named timezone keeps the window aligned across US daylight-saving changes.

The workflow updates the S&P 500 and TA-125 daily bars, derived weekly/monthly
indicators, patterns, alerts, and the market-news headline. Manual dispatch
remains available as the authenticated trigger for an external scheduler and
always bypasses the hourly deduplication gate.

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

If both price providers return no rows for a symbol that already has stored
history, the job preserves that history, records the symbol as
`skipped_unavailable`, and continues successfully. A symbol with no stored data,
database failures, pattern-publication failures, and more than 10% of the
universe being unavailable still fail the run.

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
