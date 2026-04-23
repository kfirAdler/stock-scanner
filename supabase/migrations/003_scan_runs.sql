create table if not exists public.scan_runs (
    id                bigserial primary key,
    job_name          text not null,
    timeframe         text not null default '1D',
    status            text not null,
    started_at        timestamp with time zone not null default now(),
    finished_at       timestamp with time zone,
    total_symbols     integer,
    processed_symbols integer,
    failed_symbols    integer,
    error_message     text
);

alter table public.scan_runs enable row level security;
