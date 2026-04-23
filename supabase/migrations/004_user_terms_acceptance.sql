create table if not exists public.user_terms_acceptance (
    user_id        uuid not null,
    terms_version  text not null,
    accepted_at    timestamp with time zone not null default now(),
    primary key (user_id, terms_version)
);

alter table public.user_terms_acceptance enable row level security;

create policy "Users can read own acceptance"
    on public.user_terms_acceptance for select
    to authenticated
    using (auth.uid() = user_id);

create policy "Users can insert own acceptance"
    on public.user_terms_acceptance for insert
    to authenticated
    with check (auth.uid() = user_id);
