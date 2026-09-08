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

## User-requested searches

Migration 025_pattern_scan_requests.sql adds a persistent, atomic two-hour cooldown keyed only by authenticated user ID. One request specifies exactly one pattern and one market. The quota is shared across every pattern and both markets; tabs, reloads, and application instances cannot reset it. Failed accepted jobs also retain the cooldown. Validation/auth failures consume no quota. Only service-role RPC access is granted, and the API derives user identity from the verified session.

The new request panel is independent of free browsing/filtering of existing snapshots. It shows a server-clock countdown, queued/running/completed/failed states, and an explicit View results action. Requested results keep their original candle arrays, so chart indices never accidentally use newer scheduled snapshots.

The process-pattern-requests GitHub workflow drains the queue approximately every ten minutes using the existing Supabase secrets; GitHub may delay scheduled runs. It also supports workflow_dispatch. Apply migration 025 and deploy the updated app and workflow to enable requests. No new GitHub token or browser credential is required. The implementation does not itself apply this migration or deploy the workflow.

Queued/running jobs and completed results less than two hours old are shared by pattern and market across users. The worker requests 20 symbols per database call, each with at most the latest 160 candles, using metadata keyset pagination and indexed raw-history lookups. A 500-symbol search takes about 26 history reads, one claim, and one publication; it does not refresh prices or run other detectors. Summary/status responses exclude candles. The UI polls only pending work, once per minute in visible tabs, and stops on completion/failure. Idle queue checks and authentication reads are additional.

Workers have a twenty-minute lease and a fifteen-minute processing budget. Read failures retry three times. A crashed worker can be reclaimed up to three attempts; expired workers cannot publish over a newer lease. Job results are published atomically.

Checks: node --test supabase/tests/pattern_scan_requests.test.mjs services/scanner/patterns/scan.test.mjs (local PostgreSQL binaries required); node --test tests/pattern-requests.test.cjs from web; python3 -m unittest tests.test_pattern_requests from services/scanner. Database tests create and remove their own isolated cluster, never use Supabase credentials.
