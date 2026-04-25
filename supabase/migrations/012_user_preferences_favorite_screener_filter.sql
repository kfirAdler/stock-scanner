alter table public.user_preferences
    add column if not exists favorite_screener_filter jsonb;
