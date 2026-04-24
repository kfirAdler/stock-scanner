-- US = S&P 500-style tickers (no .TA suffix). TA = Tel Aviv listings (ticker ends with .TA).

alter table public.symbol_indicator_snapshot
    add column if not exists market text not null default 'US';

alter table public.symbol_metadata
    add column if not exists market text not null default 'US';

comment on column public.symbol_indicator_snapshot.market is
    'Listing universe: US (S&P 500) or TA (TA-125, yfinance .TA symbols).';

comment on column public.symbol_metadata.market is
    'Listing universe: US or TA.';

create index if not exists idx_snapshot_timeframe_market
    on public.symbol_indicator_snapshot (timeframe, market);
