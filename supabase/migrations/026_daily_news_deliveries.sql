-- Durable idempotency for ephemeral GitHub Actions runners. No browser/user access is granted.
create table if not exists public.daily_news_deliveries (
    market_date date primary key,
    channel_id text not null,
    status text not null check (status in ('pending', 'sent')),
    report jsonb not null,
    message_id text,
    created_at timestamptz not null default now(),
    sent_at timestamptz
);
alter table public.daily_news_deliveries enable row level security;
revoke all on public.daily_news_deliveries from anon, authenticated;
grant select, insert, update, delete on public.daily_news_deliveries to service_role;
