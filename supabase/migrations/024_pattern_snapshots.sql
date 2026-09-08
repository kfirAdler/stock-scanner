-- Computed by refresh from already-loaded daily histories. No browser raw-data scans.
create table if not exists public.symbol_pattern_snapshot (
  ticker text primary key,
  market text not null check (market in ('US', 'TA')),
  company_name text,
  as_of date,
  updated_at timestamptz not null default now(),
  status text not null check (status in ('scanned', 'stale', 'insufficient_history')),
  bars_count integer not null,
  close double precision,
  matches jsonb not null default '[]'::jsonb,
  candles jsonb not null default '[]'::jsonb,
  detector_version integer not null default 1
);
create index if not exists symbol_pattern_snapshot_market_ticker_idx
  on public.symbol_pattern_snapshot (market, ticker);
alter table public.symbol_pattern_snapshot enable row level security;
revoke all on public.symbol_pattern_snapshot from anon, authenticated;
grant all on public.symbol_pattern_snapshot to service_role;
