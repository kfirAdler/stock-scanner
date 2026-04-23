create table if not exists public.symbol_metadata (
    ticker      text primary key,
    company_name text,
    sector      text,
    industry    text,
    market_cap  numeric,
    updated_at  timestamp with time zone not null default now()
);

alter table public.symbol_metadata enable row level security;

create policy "Allow authenticated read access"
    on public.symbol_metadata for select
    to authenticated
    using (true);
