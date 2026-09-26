-- Durable Discord notifications for newly detected strict chart patterns.
create table if not exists public.pattern_alert_outbox (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  ticker text not null,
  pattern text not null check (pattern in ('ascending_triangle', 'channel', 'cup_and_handle')),
  breakout_price double precision,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  discord_message_id text,
  last_error text
);
create index if not exists pattern_alert_outbox_pending_idx
  on public.pattern_alert_outbox (status, next_attempt_at, id);
alter table public.pattern_alert_outbox enable row level security;
revoke all on public.pattern_alert_outbox from anon, authenticated;
grant all on public.pattern_alert_outbox to service_role;
