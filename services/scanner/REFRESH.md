# Intraday stock refresh

The GitHub workflow targets one successful refresh per weekday hour from
**10:00 through 16:59 America/New_York**. Because GitHub cron is best effort,
it requests a wake-up every five minutes across the union of U.S. summer and
winter UTC hours. Before doing any checkout or setup, each attempt checks the
actual New York hour and completed workflow runs. Attempts outside the market
window or after that hour already succeeded become inexpensive no-ops. This
avoids relying on timezone-aware cron registration and supplies repeated
recovery opportunities when GitHub drops or delays a trigger.

The workflow updates the S&P 500 and TA-125 daily bars, derived weekly/monthly
indicators, patterns, alerts, and the market-news headline. Manual dispatch
remains available as the authenticated trigger for an external scheduler and
always bypasses the hourly deduplication gate.

Price downloads use Yahoo first. Stooq is a fallback with short connection/read
timeouts and is disabled for the rest of a run after three failed or empty
responses. The most recent stored candle is fetched again to capture its final
close and volume. Only changed/new bars are written.

The refresh reads small snapshot-state records in batches. When prices are
unchanged and all indicator snapshots are current, it skips indicator writes.
Publication timestamps detect a previous run interrupted after updating a candle.
Patterns run in a separate pass for every requested symbol on every invocation,
including symbols whose prices were unchanged or temporarily unavailable. They
publish in batches of 50; a failed batch is split until a bad symbol is isolated,
so the remaining pattern snapshots still update.

Detector version 3 keeps strict matches separate from developing candidates.
Scheduled scans persist near-matches for channels, ascending triangles, and
cup-and-handle setups inside the existing JSON snapshot, without weakening the
confirmed result set. Each published match is compared with its prior snapshot
and marked `new`, `strengthened`, `weakened`, or `stable`; the patterns page
offers separate Confirmed and Developing views.

If both price providers return no rows for a symbol that already has stored
history, the job preserves that history, records the symbol as
`skipped_unavailable`, and continues. Per-symbol price and pattern failures are
collected in the final summary and do not fail the workflow. A provider-wide
outage is also shown in that summary while allowing the best-effort run to finish
successfully. Unhandled orchestration/setup failures still fail the workflow.

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
production run should be checked for duration, provider warnings,
`skipped_unchanged`, `patterns_updated`, and `patterns_failed`. Compare Supabase
Database Health disk I/O before and after rollout; HTTP request counts alone do
not measure physical disk I/O.
