# Pattern snapshot integration

The original demo detectors and pivots are preserved as dependency-free ES modules. The local HTTP server, credentials, launch scripts and database scanning strategy are not imported.

## Data flow

The existing Python refresh collects the last 160 daily candles from each history it already loaded. After processing the universe it invokes Node once through stdin, with no shell, and upserts pattern snapshots in batches of 50. No additional OHLC reads are performed. Node 22 is configured in the refresh workflow and is also required for local refresh runs.

Apply supabase/migrations/024_pattern_snapshots.sql before running the updated refresh. The next successful refresh populates the table; until then the page shows a waiting state (or an unavailable state if the migration is missing). Deploy the web changes through the app's existing deployment workflow. No migration or deployment was performed by this implementation.

## Read cost

The authenticated API checks the existing scanner entitlement. Summary reads select no candles, page at 500 rows with stable ticker ordering, and cache each market for five minutes per server instance. In-flight reads are coalesced; failures are evicted. A cold US summary for about 500 symbols takes one or two queries. Filtering, sorting and symbol search are client-side and make no requests. Opening a setup fetches its stored candles in one cached read. Authentication/entitlement calls are separate from these market-data counts. Serverless instances maintain independent caches.

Snapshots with fewer than 60 valid daily bars or data older than seven calendar days are counted separately and excluded from active matches. Freshness is checked again by the API, so stopped refreshes cannot leave indefinitely active setups. Snapshots for successfully refreshed symbols overwrite prior matches, including empty matches. Failed symbols retain their previous snapshot until the next success and are aged out by the API. Publication failures are logged in refresh status without discarding indicator work.

The chart uses the exact stored candle array against which line indices were computed. Detail responses can be newer than the gallery; disappeared or stale setups show a message. Scores describe detector fit, not calibrated trading probabilities. Thresholds retain the demo defaults; request-controlled universe rescans and news enrichment are intentionally outside this integration.

Validation: Node's built-in test runner covers coverage, stale/short histories, duplicates, and a deterministic channel with valid overlay coordinates. TypeScript and ESLint validate the web integration.
