create table if not exists public.saved_screens (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null,
    name        text not null,
    filter_json jsonb not null,
    created_at  timestamp with time zone not null default now(),
    updated_at  timestamp with time zone not null default now()
);

create index idx_saved_screens_user on public.saved_screens (user_id);

alter table public.saved_screens enable row level security;

create policy "Users can read own screens"
    on public.saved_screens for select
    to authenticated
    using (auth.uid() = user_id);

create policy "Users can insert own screens"
    on public.saved_screens for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "Users can update own screens"
    on public.saved_screens for update
    to authenticated
    using (auth.uid() = user_id);

create policy "Users can delete own screens"
    on public.saved_screens for delete
    to authenticated
    using (auth.uid() = user_id);
