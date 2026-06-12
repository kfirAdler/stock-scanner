alter table public.global_market_notifications
    add column if not exists slot smallint not null default 1;

alter table public.global_market_notifications
    drop constraint if exists global_market_notifications_kind_market_date_key;

alter table public.global_market_notifications
    add constraint global_market_notifications_kind_market_date_slot_key
    unique (kind, market_date, slot);
