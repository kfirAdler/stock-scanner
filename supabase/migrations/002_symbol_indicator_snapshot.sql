create table if not exists public.symbol_indicator_snapshot (
    ticker                                text not null,
    timeframe                             text not null default '1D',
    last_trade_date                       date not null,
    last_bar_time                         timestamp with time zone,
    close                                 numeric not null,

    sma_20                                numeric,
    sma_50                                numeric,
    sma_150                               numeric,
    sma_200                               numeric,

    ema_20                                numeric,

    bb_middle_20_2                        numeric,
    bb_upper_20_2                         numeric,
    bb_lower_20_2                         numeric,
    pct_to_bb_upper                       numeric,
    pct_to_bb_lower                       numeric,

    atr_14                                numeric,
    atr_percent                           numeric,

    bullish_sequence_active               boolean not null default false,
    bearish_sequence_active               boolean not null default false,
    strong_up_sequence_context            boolean not null default false,
    strong_down_sequence_context          boolean not null default false,
    up_sequence_count                     integer not null default 0,
    down_sequence_count                   integer not null default 0,

    up_sequence_break_bars_ago            integer,
    down_sequence_break_bars_ago          integer,
    up_sequence_broke_recently            boolean not null default false,
    down_sequence_broke_recently          boolean not null default false,
    down_sequence_broke_in_strong_up_context  boolean not null default false,
    up_sequence_broke_in_strong_down_context  boolean not null default false,

    buy_signal                            boolean not null default false,
    sell_signal                           boolean not null default false,
    strong_buy_signal                     boolean not null default false,
    strong_sell_signal                    boolean not null default false,

    is_above_sma20                        boolean,
    is_below_sma20                        boolean,
    is_above_sma50                        boolean,
    is_below_sma50                        boolean,
    is_above_sma150                       boolean,
    is_below_sma150                       boolean,
    is_above_sma200                       boolean,
    is_below_sma200                       boolean,

    updated_at                            timestamp with time zone not null default now(),

    primary key (ticker, timeframe)
);

create index idx_snapshot_timeframe
    on public.symbol_indicator_snapshot (timeframe);

create index idx_snapshot_last_trade_date
    on public.symbol_indicator_snapshot (last_trade_date desc);

create index idx_snapshot_sma20
    on public.symbol_indicator_snapshot (timeframe, is_above_sma20, is_below_sma20);

create index idx_snapshot_sma50
    on public.symbol_indicator_snapshot (timeframe, is_above_sma50, is_below_sma50);

create index idx_snapshot_sma150
    on public.symbol_indicator_snapshot (timeframe, is_above_sma150, is_below_sma150);

create index idx_snapshot_atr
    on public.symbol_indicator_snapshot (timeframe, atr_percent);

create index idx_snapshot_recent_breaks
    on public.symbol_indicator_snapshot (timeframe, down_sequence_break_bars_ago, up_sequence_break_bars_ago);

alter table public.symbol_indicator_snapshot enable row level security;

create policy "Allow authenticated read access"
    on public.symbol_indicator_snapshot for select
    to authenticated
    using (true);
