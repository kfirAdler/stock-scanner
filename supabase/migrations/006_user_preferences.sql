create table if not exists public.user_preferences (
    user_id  uuid primary key,
    locale   text not null default 'en',
    theme    text not null default 'system',
    updated_at timestamp with time zone not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can read own preferences"
    on public.user_preferences for select
    to authenticated
    using (auth.uid() = user_id);

create policy "Users can upsert own preferences"
    on public.user_preferences for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "Users can update own preferences"
    on public.user_preferences for update
    to authenticated
    using (auth.uid() = user_id);
