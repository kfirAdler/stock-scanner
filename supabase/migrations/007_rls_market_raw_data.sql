alter table public.market_raw_data enable row level security;

create policy "Allow authenticated read access"
    on public.market_raw_data for select
    to authenticated
    using (true);
