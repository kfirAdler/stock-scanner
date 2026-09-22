# Daily market briefing — GitHub Actions

The `Daily market news to Discord` workflow generates a broad US-market digest every day at **15:00
Asia/Jerusalem**, including weekends and automatic DST handling. It sends a short caption, readable PNG
cards and a self-contained HTML attachment through the existing bot to `stock-news`. The HTML contains
clickable sources; reports are also saved as GitHub run artifacts for 14 days. Major-company stories
are ordered first internally. The existing scanner jobs and website remain unchanged.

## Activate in GitHub

1. Apply `supabase/migrations/026_daily_news_deliveries.sql` using your existing Supabase migration flow
   or SQL editor. This adds a service-role-only delivery journal so ephemeral runners cannot resend
   the same day's report. It does not alter existing tables.
2. In the repository → **Settings → Secrets and variables → Actions**, add/check these **Secrets**:

   | Secret | Purpose |
   | --- | --- |
   | `DISCORD_BOT_TOKEN` | Existing bot token, required for bot delivery |
   | `NEXT_PUBLIC_SUPABASE_URL` | Same project as the scanner; already used by its workflow |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same service-role key as the scanner |
   | `DISCORD_NEWS_CHANNEL_ID` | Optional if `stock-news` resolves uniquely; recommended |
   | `DISCORD_GUILD_ID` | Optional: restrict channel-name lookup to one server |
   | `OPENAI_API_KEY` | Optional: enables full Hebrew editorial summaries |
   | `X_BEARER_TOKEN` | Optional: official X recent-search access |

   Optional repository **Variables**: `DISCORD_NEWS_CHANNEL_NAME` (default `stock-news`),
   `NEWS_MODEL` (default `gpt-4.1-mini`), `NEWS_X_ACCOUNTS` (comma-separated handles, up to 15).
   Variables stored only in Vercel are not available to GitHub Actions.
3. Ensure the bot is in the server with View Channel, Send Messages and Attach Files permissions.
   The provided application ID `1491821240317382776` identifies the bot app, not the destination.
   `DISCORD_APPLICATION_ID` and `DISCORD_PUBLIC_KEY` are not needed for this outbound job.
4. Commit/push the changes to the repository's default branch. Scheduled workflows use that branch.
5. Under **Actions → Daily market news to Discord → Run workflow**, first leave **Send to Discord**
   unchecked. Download the generated report under **Artifacts** to review it. Run again with the
   checkbox enabled to send (only once per Israel calendar date).

Alternatively, use `DISCORD_NEWS_WEBHOOK_URL` as a repository secret; it takes precedence over bot settings.
If the bot sees several text channels named `stock-news`, the job stops instead of selecting one arbitrarily.
Set the channel ID (Developer Mode → right-click the channel → Copy Channel ID) in that case.
Bots in more than 20 servers must supply a guild or channel ID.

GitHub supports the workflow's IANA `timezone` field. Scheduled execution may be delayed or dropped
under load; **15:00 is the target start, not a guaranteed delivery minute**. Collection, optional summary
and image rendering add processing time. An ordinary delayed scheduled run retains the 24-hour window
ending at 15:00. Manually run reports use the trailing 24 hours ending at invocation. If GitHub drops a
run, manually trigger it. Disable this workflow in GitHub Actions to pause daily delivery.
No GitHub workflow has been pushed, remote migration applied or Discord message sent by adding these files.

## Content and current limits

* Public Google News RSS and Yahoo Finance work without extra news-provider credentials, following
  the providers the scanner already uses. Search is sampled, not exhaustive for every US listing.
* **Without `OPENAI_API_KEY`, original-language headlines are shown with Hebrew section headings**,
  and a visible note states that Hebrew summarization is not enabled. Configure a key for full Hebrew
  summaries. The Responses API uses `NEWS_MODEL`; API usage is separately billed. On a model failure,
  the report visibly falls back to original titles.
* The model only receives headlines/snippets, not full articles. It must cite provided source IDs;
  code rejects fabricated IDs, invalid shapes and oversized text. This constrains but cannot guarantee
  semantic accuracy. Sources and publication times remain visible for verification.
* Coverage includes market context, macro/geopolitics, companies across sectors, and upcoming events
  only when explicitly present in the supplied news. There is no dedicated economic-calendar feed yet.
* Items must have a timezone-aware publication date within the exact 24-hour window. Missing, stale
  and future dates are excluded. Exact duplicate titles/URLs are removed; when configured, the model
  also consolidates coverage of the same event. Company selection retains space for non-mega-cap stories.
* X needs both its API token and account list. Collection is bounded to 300 posts/run. Social-only
  claims are visibly labeled unverified. Source failures and missing market quotes are disclosed.
* Quotes use Yahoo's last available daily bar, possibly developing or from the prior close. They are
  not guaranteed real-time. Displayed percentages compare daily bars, not necessarily trailing 24 hours;
  session dates are printed in each card. Prices are fetched when the job executes.
* PNG cards hold up to six points apiece to avoid cutting text across images. HTML, JSON and images are
  saved locally; Discord receives HTML and images in one message, with mentions disabled.

## Duplicate protection and recovery

`NEWS_STATE_BACKEND=supabase` is set by the workflow. The journal uses a unique Israel calendar date.
A `pending` row is atomically inserted **before** Discord is called; success records `sent`, message ID
and timestamp. The generated report is retained in the row. Concurrent runners cannot claim the same day.
Timeouts, crashes and ambiguous Discord server errors leave the pending row intact: check the channel
before retrying. Only if you confirm no report was delivered should you remove that date's pending row
and run again. Explicit 4xx rejections release the reservation; 429 requests have bounded retries.
A pending report fails the job visibly instead of being resent. Journal outages stop sending.
The design favors preventing duplicate messages over blindly retrying uncertain deliveries.

GitHub artifacts/cache are not relied on as the delivery lock. GitHub concurrency also serializes runs.
Do not enable a separate local scheduler with independent local state for the same Discord channel.

## Local preview (optional)

From `services/scanner`, using Python 3.10+ on macOS/Linux:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-daily-news.txt
.venv/bin/python -m playwright install chromium
.venv/bin/python run_daily_news.py --demo
.venv/bin/python run_daily_news.py
```

On Linux, use `python -m playwright install --with-deps chromium` for browser system dependencies.
The offline demo is marked as fictional and cannot send. A normal run only creates local files by default.
Outputs: `daily-news-output/YYYY-MM-DD/`. `--html-only` skips Chromium; `--send` explicitly sends.
`--scheduled` fixes the cutoff to today's 15:00 Israel time and refuses to run before that time.
Merge `daily-news.env.example` into the repository root `.env.local` without overwriting existing secrets.
Environment variables override that file. Output/state directories are ignored by Git.

Local `--daemon` and deployment service templates are available for an always-on host as an alternative
to Actions, not alongside it. It runs daily at 15:00 Israel time and catches up today's report after a
restart. Local state defaults to a file lock + durable JSON marker; set `NEWS_STATE_BACKEND=supabase`
to share the same journal with Actions. A local pending marker requires the same manual delivery check.

## Verification

```sh
.venv/bin/pip install pytest
.venv/bin/python -m pytest tests/test_daily_news.py -q
```

Tests cover dates/DST, source validation, priority and sector coverage, escaping, bot delivery, channel
ambiguity, safe previews, duplicate protection and failure handling. Tests never send live messages.

References: [GitHub schedules and timezone](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[Discord bot messages](https://docs.discord.com/developers/resources/message#create-message),
[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[X recent search](https://docs.x.com/x-api/posts/search-recent-posts).
