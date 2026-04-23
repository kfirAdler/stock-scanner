# Stock Scanner Platform Specification for Claude Opus

## Mission

Build a production-quality stock scanner web app with excellent UX, strong accessibility, full Hebrew and English support, and a clean architecture that is easy to extend.

The platform should allow users to screen stocks using precomputed market states rather than recalculating all indicators on each search.

The app will use:
- Next.js + React + TypeScript for the web app
- Supabase Postgres for storage and auth
- Python for scheduled market-data refresh and indicator computation
- Vercel for web app deployment

The implementation must prioritize:
- speed
- clarity
- modularity
- accessibility
- internationalization
- maintainability
- low operational complexity

---

## Core architectural decision

Do not build a market-wide recalculation engine that runs on every user search.

Instead, build a **precompute + query** architecture:

1. Historical bars are stored in `public.market_raw_data`
2. A scheduled Python job updates bars and computes derived fields
3. The latest computed state for each symbol is stored in a snapshot table
4. The UI reads from the snapshot table using fast DB queries

This is the correct design because the current Pine logic is not just simple indicator math. It includes stateful logic such as:
- sequence tracking
- sequence break detection
- strong up and strong down sequence context
- fractal state
- event-style buy and sell signals

That logic should be computed offline in Python and persisted.

---

## Existing database state

Current raw data table:

`public.market_raw_data`

### Actual schema

```sql
ticker      text                     not null
trade_date  date                     not null
open        numeric                  not null
high        numeric                  not null
low         numeric                  not null
close       numeric                  not null
volume      numeric                  not null
created_at  timestamp with time zone not null
bar_time    timestamp with time zone null
```

### Actual primary key

```sql
primary key (ticker, trade_date)
```

### Actual index

```sql
create unique index market_raw_data_pkey
on public.market_raw_data (ticker, trade_date);
```

### Actual data characteristics

- total rows: 375,565
- total tickers: 510
- date range: 2023-04-05 through 2026-04-17
- typical history depth: about 750 daily bars per ticker

This is a solid daily dataset and is sufficient for the first production version of the screener.

---

## Product requirements

## Authentication
Users must be able to:
- sign in with Google
- register with email and password
- sign in with email and password
- sign out securely

Use Supabase Auth.

---

## Internationalization
The product must fully support:
- Hebrew
- English

Requirements:
- full RTL support for Hebrew
- full LTR support for English
- proper layout flipping where needed
- language switcher
- locale-aware text handling
- no broken mixed-direction layouts

Use a clean i18n setup.
Every visible string must be translation-ready.

---

## Typography
The UI must use:
- Assistant Light
- Assistant Bold

This is a hard requirement.

The typography system must work properly in both Hebrew and English.

---

## Accessibility
Accessibility is mandatory.

Requirements:
- semantic HTML
- keyboard navigation
- visible focus states
- accessible forms
- accessible tables
- proper labels and aria usage
- sufficient contrast in both light and dark themes
- reduced motion support where relevant
- screen-reader-friendly interactions
- accessible auth flow
- accessible language toggle
- accessible dark and light mode toggle

Do not treat accessibility as optional polish.
It is a baseline requirement.

---

## Theme support
The site must support:
- dark mode
- light mode

Requirements:
- persistent theme preference
- strong contrast
- no unreadable chart or table states
- theme toggle accessible by keyboard and screen readers

---

## Terms of use
The platform must include Terms of Use acceptance as a required step.

Requirements:
- a Terms of Use page
- mandatory acceptance during registration
- acceptance version tracking
- storage of acceptance timestamp per user
- user cannot complete registration without accepting the terms

---

## Screener UX model

The user experience should be based on grouped horizontal filter sections.

Each group belongs to a logical tab or segment, for example:
- Moving Averages
- Bands
- Sequences
- Price / Fundamentals
- Volatility

Within each group, filters are displayed as well-organized checkbox and input controls.

The design should feel premium, fast, and structured rather than cluttered.

---

## MVP filter requirements

These are the first required screening capabilities.

## 1. Moving averages

The user must be able to filter for:

- above SMA 20
- below SMA 20
- above SMA 50
- below SMA 50
- above SMA 150
- below SMA 150
- above SMA X
- below SMA X

### Notes
- `SMA X` means the user can input a custom moving average length
- for the first version, custom SMA filtering can be implemented by querying precomputed standard fields if X is one of the supported values, or by computing requested custom SMA values in the scheduled snapshot if custom support is intentionally limited
- the first production version should clearly define which SMA lengths are officially supported in the snapshot

Recommended precomputed lengths for the snapshot:
- 20
- 50
- 150
- 200

If custom SMA X is supported in the UI for arbitrary values, that feature should be scoped carefully because storing every possible SMA length is not practical.

Preferred MVP solution:
- explicitly support fixed SMA lengths first
- optionally support a small controlled custom SMA set later

---

## 2. Bollinger Bands

The system must compute Bollinger Bands and support these filters:

- within 2 percent of upper band
- within 2 percent of lower band

Recommended implementation:
- compute standard Bollinger Bands using 20-period SMA and 2 standard deviations
- store:
  - bb_middle_20_2
  - bb_upper_20_2
  - bb_lower_20_2
  - pct_to_bb_upper
  - pct_to_bb_lower

This makes queries very fast.

---

## 3. Sequence-based filters

Use the Pine-derived sequence logic as the business source for sequence state.

Required filters:
- down sequence broke within the last 2 candles
- up sequence broke within the last 2 candles
- down sequence broke during strong up sequence context

These should not be approximated with simple price rules.
They must be computed using the translated Pine logic.

To support this, store fields such as:
- bullish_sequence_active
- bearish_sequence_active
- strong_up_sequence_context
- strong_down_sequence_context
- down_sequence_break_bars_ago
- up_sequence_break_bars_ago
- down_sequence_broke_recently
- up_sequence_broke_recently
- down_sequence_broke_in_strong_up_context
- up_sequence_broke_in_strong_down_context

For the recent-break filters:
- a value of 0 means broke on the current latest candle
- a value of 1 means broke one candle ago
- a value of 2 means broke two candles ago

Then the UI can filter with:
- `down_sequence_break_bars_ago <= 2`
- `up_sequence_break_bars_ago <= 2`

---

## 4. ATR filters

The system must support:
- ATR 14 days smaller than X percent
- ATR 14 days greater than X percent

Recommended stored fields:
- atr_14
- atr_percent

Where:
- `atr_percent = atr_14 / close * 100`

The UI should allow numeric threshold input.

---

## 5. Price and fundamentals section

The user wants a tab or filter section that includes price-related and market-cap-related criteria.

For MVP, include:
- market cap value
- optional future filter hooks for price ranges

Recommended fields:
- market_cap
- close

Important note:
`market_cap` is not present in the current raw table.
It must come from a reliable symbol metadata source or another enrichment process.

For the first version, if market cap is not yet available from a stable source, build the UI to support the section structure but keep market-cap filtering behind a clearly marked feature flag or milestone.

---

## Serverless function design constraint

This project must intentionally stay under **10 total server-side functions/endpoints/jobs** as an internal architecture rule to keep the Vercel deployment simple and maintainable.

This is a project constraint, not a documented general Vercel platform limit.

Do not create a sprawling function architecture.

Prefer a compact design with a small number of high-value endpoints.

---

## Important Vercel constraints

These platform facts matter:

- Hobby cron jobs are limited to once per day
- Vercel does not guarantee exact cron invocation timing within the hour on Hobby
- Vercel Functions have duration limits
- Hobby default function duration is lower than Pro
- long-running heavy batch logic should not depend on synchronous request lifecycles

Because of that:

### Required interpretation
If the product needs a job that runs every 5 hours during US market days, do not assume this will work on Vercel Hobby cron.
That schedule requires at least a plan/setup that supports more frequent cron runs, or an external scheduler. citeturn153811search2turn153811search3turn153811search10turn153811search11

---

## Required scheduled refresh behavior

The product needs a refresh function that wakes up every 5 hours and refreshes the SP500 dataset, but only in US trading context.

However, implement this correctly:

### Business requirement
- refresh the SP500 dataset on a schedule
- avoid unnecessary updates outside relevant trading windows
- keep the dataset bounded in size
- keep approximately the latest 750 rows per ticker

### Technical implementation rule
Use a scheduler-compatible architecture:
- if deployed on Vercel Pro or another environment that supports the schedule, use a scheduled trigger
- otherwise allow the same Python refresh job to be called by an external scheduler without code changes

Do not hardcode the system to depend only on Vercel Hobby cron behavior. citeturn153811search2turn153811search10

### Raw data retention rule
When a new bar is inserted for a ticker:
- keep only the newest 750 rows for that ticker
- delete older rows beyond that retention threshold

This retention cleanup should be done safely and efficiently in batch, not row-by-row with naive logic if avoidable.

---

## Recommended backend/server function list

Keep the backend surface small.

Suggested maximum set:

1. `GET /api/screener`
   - query the computed snapshot with filters

2. `GET /api/screener/options`
   - return filter metadata and supported values

3. `GET /api/tickers/[ticker]`
   - return latest snapshot plus recent bars for one symbol

4. `GET /api/me`
   - return current user profile, settings, locale, theme, and terms acceptance state

5. `POST /api/preferences`
   - update theme, locale, and user preferences

6. `POST /api/terms/accept`
   - persist terms acceptance

7. `GET /api/saved-screens`
   - list saved screens

8. `POST /api/saved-screens`
   - create or update saved screens

9. `POST /api/admin/refresh-market-snapshot`
   - secure trigger endpoint for refresh job orchestration if needed

10. `POST /api/admin/recompute-symbol`
   - optional internal repair endpoint for one ticker

Do not create many tiny endpoints unless clearly justified.

---

## Database design

## Keep the existing table

### `public.market_raw_data`

Use this as:
- historical source of truth
- recomputation source
- debugging source

Do not replace it.

---

## Create a metadata table if needed

### `public.symbol_metadata`

Purpose:
Store non-price symbol metadata needed by the app.

Suggested fields:
```sql
ticker text primary key,
company_name text,
sector text,
industry text,
market_cap numeric,
updated_at timestamp with time zone not null default now()
```

This table may be populated by a separate enrichment process if required.

---

## Create the main snapshot table

### `public.symbol_indicator_snapshot`

Purpose:
One latest computed row per ticker per timeframe.

Suggested schema:

```sql
create table public.symbol_indicator_snapshot (
    ticker text not null,
    timeframe text not null default '1D',
    last_trade_date date not null,
    last_bar_time timestamp with time zone,
    close numeric not null,

    sma_20 numeric,
    sma_50 numeric,
    sma_150 numeric,
    sma_200 numeric,

    ema_20 numeric,

    bb_middle_20_2 numeric,
    bb_upper_20_2 numeric,
    bb_lower_20_2 numeric,
    pct_to_bb_upper numeric,
    pct_to_bb_lower numeric,

    atr_14 numeric,
    atr_percent numeric,

    bullish_sequence_active boolean not null default false,
    bearish_sequence_active boolean not null default false,
    strong_up_sequence_context boolean not null default false,
    strong_down_sequence_context boolean not null default false,
    up_sequence_count integer not null default 0,
    down_sequence_count integer not null default 0,

    up_sequence_break_bars_ago integer,
    down_sequence_break_bars_ago integer,
    up_sequence_broke_recently boolean not null default false,
    down_sequence_broke_recently boolean not null default false,
    down_sequence_broke_in_strong_up_context boolean not null default false,
    up_sequence_broke_in_strong_down_context boolean not null default false,

    buy_signal boolean not null default false,
    sell_signal boolean not null default false,
    strong_buy_signal boolean not null default false,
    strong_sell_signal boolean not null default false,

    is_above_sma20 boolean,
    is_below_sma20 boolean,
    is_above_sma50 boolean,
    is_below_sma50 boolean,
    is_above_sma150 boolean,
    is_below_sma150 boolean,
    is_above_sma200 boolean,
    is_below_sma200 boolean,

    updated_at timestamp with time zone not null default now(),

    primary key (ticker, timeframe)
);
```

### Suggested indexes

```sql
create index idx_snapshot_timeframe on public.symbol_indicator_snapshot (timeframe);
create index idx_snapshot_last_trade_date on public.symbol_indicator_snapshot (last_trade_date desc);
create index idx_snapshot_sma20 on public.symbol_indicator_snapshot (timeframe, is_above_sma20, is_below_sma20);
create index idx_snapshot_sma50 on public.symbol_indicator_snapshot (timeframe, is_above_sma50, is_below_sma50);
create index idx_snapshot_sma150 on public.symbol_indicator_snapshot (timeframe, is_above_sma150, is_below_sma150);
create index idx_snapshot_atr on public.symbol_indicator_snapshot (timeframe, atr_percent);
create index idx_snapshot_recent_breaks on public.symbol_indicator_snapshot (timeframe, down_sequence_break_bars_ago, up_sequence_break_bars_ago);
```

Add more indexes only after observing actual query patterns.

---

## Create scan run logging

### `public.scan_runs`

```sql
create table public.scan_runs (
    id bigserial primary key,
    job_name text not null,
    timeframe text not null default '1D',
    status text not null,
    started_at timestamp with time zone not null default now(),
    finished_at timestamp with time zone,
    total_symbols integer,
    processed_symbols integer,
    failed_symbols integer,
    error_message text
);
```

---

## Terms acceptance persistence

Use either a dedicated table or user profile extension.

Preferred table:

### `public.user_terms_acceptance`

```sql
create table public.user_terms_acceptance (
    user_id uuid not null,
    terms_version text not null,
    accepted_at timestamp with time zone not null default now(),
    primary key (user_id, terms_version)
);
```

---

## Saved screens

### `public.saved_screens`

```sql
create table public.saved_screens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    name text not null,
    filter_json jsonb not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);
```

---

## Query examples

### Above SMA 20 and below SMA 50

```sql
select *
from public.symbol_indicator_snapshot
where timeframe = '1D'
  and is_above_sma20 = true
  and is_below_sma50 = true
order by ticker;
```

### Above SMA 150

```sql
select *
from public.symbol_indicator_snapshot
where timeframe = '1D'
  and is_above_sma150 = true
order by ticker;
```

### Down sequence broke within last 2 candles

```sql
select *
from public.symbol_indicator_snapshot
where timeframe = '1D'
  and down_sequence_break_bars_ago is not null
  and down_sequence_break_bars_ago <= 2
order by ticker;
```

### Up sequence broke within last 2 candles

```sql
select *
from public.symbol_indicator_snapshot
where timeframe = '1D'
  and up_sequence_break_bars_ago is not null
  and up_sequence_break_bars_ago <= 2
order by ticker;
```

### Down sequence broke in strong up context

```sql
select *
from public.symbol_indicator_snapshot
where timeframe = '1D'
  and down_sequence_broke_in_strong_up_context = true
order by ticker;
```

### ATR percent smaller than X

```sql
select *
from public.symbol_indicator_snapshot
where timeframe = '1D'
  and atr_percent < :threshold
order by atr_percent asc, ticker;
```

### ATR percent greater than X

```sql
select *
from public.symbol_indicator_snapshot
where timeframe = '1D'
  and atr_percent > :threshold
order by atr_percent desc, ticker;
```

### Within 2 percent of upper Bollinger Band

```sql
select *
from public.symbol_indicator_snapshot
where timeframe = '1D'
  and pct_to_bb_upper <= 2
order by pct_to_bb_upper asc, ticker;
```

### Within 2 percent of lower Bollinger Band

```sql
select *
from public.symbol_indicator_snapshot
where timeframe = '1D'
  and pct_to_bb_lower <= 2
order by pct_to_bb_lower asc, ticker;
```

---

## Refresh engine requirements

The Python job must:

1. load all active SP500 tickers
2. refresh market bars
3. upsert new daily bars into `market_raw_data`
4. enforce retention of roughly 750 latest rows per ticker
5. recompute the latest snapshot row for each ticker
6. upsert into `symbol_indicator_snapshot`
7. log status into `scan_runs`

### Important
Do not write the refresh logic as a giant monolith.

Recommended structure:

```text
services/
  scanner/
    src/
      config/
      repositories/
      indicators/
      signals/
      jobs/
      models/
      utils/
    tests/
```

### Module responsibilities

#### `repositories/market_data_repository.py`
- fetch historical bars
- insert new bars
- enforce retention
- read symbol histories
- upsert snapshots
- log scan runs

#### `indicators/`
- sma
- ema
- bollinger bands
- atr

#### `signals/`
- translated sequence logic from Pine
- strong sequence context
- sequence break detection
- event flags

#### `jobs/refresh_market_snapshot.py`
- orchestration entrypoint
- safe batching
- run logging
- partial failure handling

---

## Pine translation rules

The Pine code is the source for sequence behavior.
Its logic must be translated carefully and tested.

Do not simplify sequence logic into generic trend labels if that changes semantics.

The translated Python code should expose deterministic outputs for:
- bullish sequence active
- bearish sequence active
- strong up sequence context
- strong down sequence context
- sequence break bars ago
- buy signal
- sell signal
- strong buy signal
- strong sell signal

Write tests that compare expected outputs on controlled sample bar sequences.

---

## Frontend expectations

The product should feel fast and premium.

Pages:
- dashboard
- screener
- ticker detail page
- saved screens
- authentication flows
- settings
- terms page

### Screener page requirements
- grouped filter tabs
- horizontal filter layout
- excellent spacing and visual hierarchy
- responsive behavior
- fast result updates
- loading states
- empty states
- sortable table
- accessible controls
- support for both RTL and LTR layouts

### Table requirements
Results table should include at least:
- ticker
- close
- SMA relationships
- ATR percent
- sequence state summary
- recent break flags
- Bollinger proximity metrics if relevant

---

## Technology requirements

## Frontend
- Next.js App Router
- React
- TypeScript
- full support for RTL and LTR
- proper font loading for Assistant
- i18n-ready structure
- accessible component patterns

## Backend compute
- Python 3.11+
- pandas and numpy are acceptable
- code must remain modular and readable

## Auth
- Supabase Auth
- Google sign-in
- email/password registration and login

## State and preferences
Persist:
- locale
- theme
- terms acceptance
- saved screens

---

## Coding standards

- no giant files
- no unnecessary comments
- code should be readable by naming and structure
- strongly typed frontend code
- modular Python services
- minimal endpoint surface
- no duplicated business logic across frontend and backend
- no indicator math in React components
- no stateful sequence logic in SQL

---

## Delivery expectation

Build the app as a clean MVP first with the exact filters requested in this document.

Do not overbuild.
Do not add many speculative features.
Focus on:
- stable auth
- high-quality screener UX
- accessibility
- dual-language support
- clean snapshot computation
- compact Vercel-friendly backend shape

---

## Final instruction

This is a bilingual, accessible, premium stock screening product.

The implementation must:
- support Hebrew and English
- support RTL and LTR
- use Assistant Light and Assistant Bold
- require Terms of Use acceptance
- support dark and light mode
- support Google sign-in and email/password auth
- keep server-side architecture intentionally compact
- use scheduled precomputation rather than on-demand market-wide scans
