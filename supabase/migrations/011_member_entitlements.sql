-- Who may access market snapshots, screener data, and ticker APIs when paywall is enabled.
-- Set tier = 'pro' for paying members (SQL, admin tool, or future Stripe webhook via service role).

create table if not exists public.member_entitlements (
    user_id    uuid primary key references auth.users (id) on delete cascade,
    tier       text not null default 'free' check (tier in ('free', 'pro')),
    updated_at timestamptz not null default now()
);

comment on table public.member_entitlements is
    'Access tier for premium market data. Missing row = free.';

alter table public.member_entitlements enable row level security;

create policy "Users read own entitlement"
    on public.member_entitlements for select
    to authenticated
    using (auth.uid() = user_id);
