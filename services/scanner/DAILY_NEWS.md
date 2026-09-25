# Daily Market Brief

The `Daily market news to Discord` workflow creates one Hebrew-first, mobile portrait market brief every day at **15:00 Asia/Jerusalem**. Staggered GitHub attempts and the Supabase delivery journal ensure that only one report is delivered per Israel calendar date.

Discord receives one **1080×1920 PNG** with the caption `@everyone 📈 Daily Market Brief | DD.MM.YYYY`. The HTML and normalized JSON report remain available in the workflow artifact for 14 days.

## Content pipeline

The report is deterministic and uses no LLM, translation API, or paid news API:

1. Fetch public metadata concurrently from Hebrew Google News RSS searches, Sponser RSS, Bizportal structured article metadata, SEC EDGAR, and Nasdaq Trader.
2. Isolate provider failures; one timeout, 403, or malformed feed does not stop the report.
3. Normalize title, canonical URL, source, source URL, publication time, language, market, category, provider, and recognized tickers.
4. Remove tracking parameters, sponsored/personal-finance/lifestyle material, stale stories, exact URL duplicates, and title clusters with at least 0.72 Jaccard similarity within 12 hours.
5. Score freshness, source quality, language, category, ticker relevance, and independent multi-source coverage.
6. Select at most 12 items with no more than three per publisher, two per ticker, two Israeli stories, or two English stories when Hebrew coverage is available.
7. Render the highest-ranked stories that fit one fixed 540×960 CSS-pixel canvas at device scale factor 2. Low-ranked stories are removed before spacing or readable type is reduced.

SEC and Nasdaq Trader are signal sources. Technical filings without a recognized company are not displayed as standalone headlines. Bizportal scraping is isolated and reads only structured metadata; it never bypasses access controls or copies article bodies.

The market strip contains S&P 500, Nasdaq, Dow, WTI, Bitcoin, and the U.S. 10-year yield from Yahoo Finance. The “20 seconds” line uses only deterministic quote movements and keyword flags.

## Required configuration

Apply `supabase/migrations/026_daily_news_deliveries.sql`, then configure these GitHub Actions secrets:

| Secret | Purpose |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Existing Discord bot token |
| `DISCORD_NEWS_CHANNEL_ID` | Recommended destination channel ID |
| `DISCORD_GUILD_ID` | Optional channel lookup restriction |
| `DISCORD_NEWS_WEBHOOK_URL` | Optional alternative to bot delivery |
| `NEXT_PUBLIC_SUPABASE_URL` | Delivery journal project |
| `SUPABASE_SERVICE_ROLE_KEY` | Delivery journal service-role access |

Optional variable: `DISCORD_NEWS_CHANNEL_NAME` defaults to `stock-news`. For SEC identification, `SEC_USER_AGENT` may be set to a product/contact string.

No `OPENAI_API_KEY`, model variable, X API credential, or news-provider key is used.

## Delivery safety

`NEWS_STATE_BACKEND=supabase` is set by the workflow. A `pending` journal row is claimed before Discord is called. Confirmed success records the Discord message ID. Ambiguous timeouts retain the claim so the job cannot blindly send a duplicate; inspect Discord before manually releasing such a row. Explicit 4xx rejection releases the claim, and 429 responses receive bounded retries.

GitHub scheduling is best effort, so the workflow requests wake-ups every five
minutes in both possible UTC hours for 15:00 Israel time. A pre-check accepts
only 15:00–15:59 `Asia/Jerusalem` and stops after the first successful scheduled
run that day. This avoids timezone-dependent cron registration and provides up
to 12 valid attempts while the Supabase journal still permits only one Discord
delivery. Manual previews never send unless `--send` is explicitly supplied.

## Local preview

From `services/scanner`:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-daily-news.txt
.venv/bin/python -m playwright install chromium
.venv/bin/python run_daily_news.py --demo
.venv/bin/python run_daily_news.py
```

Outputs are written to `daily-news-output/YYYY-MM-DD/`. `report.json` retains source URLs and metadata, `report.html` is a local clickable preview, and `news-01.png` is the Discord artifact. `--html-only` skips Chromium and cannot be combined with sending.

## Verification

```sh
.venv/bin/pip install pytest
.venv/bin/python -m pytest tests/test_daily_news.py -q
```

Tests cover source isolation, date windows, normalization, deterministic selection, duplicate filtering, portrait dimensions, escaping, Discord delivery, scheduling, and duplicate protection. Tests never send Discord messages.
