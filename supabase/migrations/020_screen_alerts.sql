-- screen_alerts: one enabled/disabled subscription per user per saved screen
create table if not exists public.screen_alerts (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    saved_screen_id uuid not null references public.saved_screens(id) on delete cascade,
    enabled         boolean not null default true,
    last_tickers    text[],
    last_checked_at timestamp with time zone,
    created_at      timestamp with time zone not null default now(),
    updated_at      timestamp with time zone not null default now(),
    unique (user_id, saved_screen_id)
);

create index idx_screen_alerts_user on public.screen_alerts (user_id);
create index idx_screen_alerts_enabled on public.screen_alerts (enabled) where enabled = true;

alter table public.screen_alerts enable row level security;

create policy "Users can read own alerts"
    on public.screen_alerts for select
    to authenticated
    using (auth.uid() = user_id);

create policy "Users can insert own alerts"
    on public.screen_alerts for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "Users can update own alerts"
    on public.screen_alerts for update
    to authenticated
    using (auth.uid() = user_id);

create policy "Users can delete own alerts"
    on public.screen_alerts for delete
    to authenticated
    using (auth.uid() = user_id);

-- alert_notifications: inbox rows created by the background job
create table if not exists public.alert_notifications (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    saved_screen_id uuid not null references public.saved_screens(id) on delete cascade,
    screen_name     text not null,
    new_tickers     text[] not null,
    triggered_at    timestamp with time zone not null default now(),
    seen_at         timestamp with time zone
);

create index idx_alert_notif_user_time on public.alert_notifications (user_id, triggered_at desc);
create index idx_alert_notif_user_unseen on public.alert_notifications (user_id) where seen_at is null;

alter table public.alert_notifications enable row level security;

create policy "Users can read own notifications"
    on public.alert_notifications for select
    to authenticated
    using (auth.uid() = user_id);

create policy "Users can update own notifications"
    on public.alert_notifications for update
    to authenticated
    using (auth.uid() = user_id);
