create table if not exists public.global_market_notifications (
    id uuid primary key default gen_random_uuid(),
    kind text not null default 'daily_top_news',
    market_date date not null,
    headline text not null,
    source text,
    url text,
    published_at timestamp with time zone not null,
    expires_at timestamp with time zone not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    unique (kind, market_date)
);

create index idx_global_market_notifications_active
    on public.global_market_notifications (expires_at desc);

alter table public.global_market_notifications enable row level security;

create policy "Authenticated users can read global market notifications"
    on public.global_market_notifications for select
    to authenticated
    using (true);

create table if not exists public.user_global_notification_reads (
    user_id uuid not null references auth.users(id) on delete cascade,
    notification_id uuid not null references public.global_market_notifications(id) on delete cascade,
    seen_at timestamp with time zone not null default now(),
    created_at timestamp with time zone not null default now(),
    primary key (user_id, notification_id)
);

create index idx_user_global_notification_reads_user
    on public.user_global_notification_reads (user_id, seen_at desc);

alter table public.user_global_notification_reads enable row level security;

create policy "Users can read own global notification reads"
    on public.user_global_notification_reads for select
    to authenticated
    using (auth.uid() = user_id);

create policy "Users can insert own global notification reads"
    on public.user_global_notification_reads for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "Users can update own global notification reads"
    on public.user_global_notification_reads for update
    to authenticated
    using (auth.uid() = user_id);
