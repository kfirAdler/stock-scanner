alter table public.symbol_indicator_snapshot
    add column if not exists rsi_14 numeric,
    add column if not exists relative_volume_20 numeric,
    add column if not exists is_up_day boolean not null default false;

create index if not exists idx_snapshot_rsi14
    on public.symbol_indicator_snapshot (timeframe, rsi_14);

create index if not exists idx_snapshot_relative_volume_20
    on public.symbol_indicator_snapshot (timeframe, relative_volume_20);

create index if not exists idx_snapshot_is_up_day
    on public.symbol_indicator_snapshot (timeframe, is_up_day);

create or replace function public.screener_rule_matches(
    rule jsonb,
    snap public.symbol_indicator_snapshot
) returns boolean
language sql
immutable
as $$
select case
    when snap is null then false
    when coalesce(rule->>'field', '') = 'is_above_sma20' then coalesce(snap.is_above_sma20, false)
    when coalesce(rule->>'field', '') = 'is_below_sma20' then coalesce(snap.is_below_sma20, false)
    when coalesce(rule->>'field', '') = 'is_above_sma50' then coalesce(snap.is_above_sma50, false)
    when coalesce(rule->>'field', '') = 'is_below_sma50' then coalesce(snap.is_below_sma50, false)
    when coalesce(rule->>'field', '') = 'is_above_sma150' then coalesce(snap.is_above_sma150, false)
    when coalesce(rule->>'field', '') = 'is_below_sma150' then coalesce(snap.is_below_sma150, false)
    when coalesce(rule->>'field', '') = 'is_above_sma200' then coalesce(snap.is_above_sma200, false)
    when coalesce(rule->>'field', '') = 'is_below_sma200' then coalesce(snap.is_below_sma200, false)
    when coalesce(rule->>'field', '') = 'down_sequence_broke_recently' then coalesce(snap.down_sequence_broke_recently, false)
    when coalesce(rule->>'field', '') = 'up_sequence_broke_recently' then coalesce(snap.up_sequence_broke_recently, false)
    when coalesce(rule->>'field', '') = 'down_sequence_broke_in_strong_up_context' then coalesce(snap.down_sequence_broke_in_strong_up_context, false)
    when coalesce(rule->>'field', '') = 'up_sequence_broke_in_strong_down_context' then coalesce(snap.up_sequence_broke_in_strong_down_context, false)
    when coalesce(rule->>'field', '') = 'buy_signal' then coalesce(snap.buy_signal, false)
    when coalesce(rule->>'field', '') = 'sell_signal' then coalesce(snap.sell_signal, false)
    when coalesce(rule->>'field', '') = 'strong_buy_signal' then coalesce(snap.strong_buy_signal, false)
    when coalesce(rule->>'field', '') = 'strong_sell_signal' then coalesce(snap.strong_sell_signal, false)
    when coalesce(rule->>'field', '') = 'bullish_sequence_active' then coalesce(snap.bullish_sequence_active, false)
    when coalesce(rule->>'field', '') = 'bearish_sequence_active' then coalesce(snap.bearish_sequence_active, false)
    when coalesce(rule->>'field', '') = 'strong_up_sequence_context' then coalesce(snap.strong_up_sequence_context, false)
    when coalesce(rule->>'field', '') = 'strong_down_sequence_context' then coalesce(snap.strong_down_sequence_context, false)
    when coalesce(rule->>'field', '') = 'is_up_day' then coalesce(snap.is_up_day, false)
    when coalesce(rule->>'field', '') = 'pct_to_bb_upper' and coalesce(rule->>'operator', '') = 'lte'
        then snap.pct_to_bb_upper is not null and snap.pct_to_bb_upper <= (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'pct_to_bb_upper' and coalesce(rule->>'operator', '') = 'gte'
        then snap.pct_to_bb_upper is not null and snap.pct_to_bb_upper >= (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'pct_to_bb_lower' and coalesce(rule->>'operator', '') = 'lte'
        then snap.pct_to_bb_lower is not null and snap.pct_to_bb_lower <= (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'pct_to_bb_lower' and coalesce(rule->>'operator', '') = 'gte'
        then snap.pct_to_bb_lower is not null and snap.pct_to_bb_lower >= (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'atr_percent' and coalesce(rule->>'operator', '') = 'lt'
        then snap.atr_percent is not null and snap.atr_percent < (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'atr_percent' and coalesce(rule->>'operator', '') = 'gt'
        then snap.atr_percent is not null and snap.atr_percent > (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'atr_14' and coalesce(rule->>'operator', '') = 'lt'
        then snap.atr_14 is not null and snap.atr_14 < (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'atr_14' and coalesce(rule->>'operator', '') = 'gt'
        then snap.atr_14 is not null and snap.atr_14 > (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'close' and coalesce(rule->>'operator', '') = 'gte'
        then snap.close is not null and snap.close >= (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'close' and coalesce(rule->>'operator', '') = 'lte'
        then snap.close is not null and snap.close <= (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'rsi_14' and coalesce(rule->>'operator', '') = 'lte'
        then snap.rsi_14 is not null and snap.rsi_14 <= (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'rsi_14' and coalesce(rule->>'operator', '') = 'gte'
        then snap.rsi_14 is not null and snap.rsi_14 >= (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'relative_volume_20' and coalesce(rule->>'operator', '') = 'gt'
        then snap.relative_volume_20 is not null and snap.relative_volume_20 > (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'relative_volume_20' and coalesce(rule->>'operator', '') = 'lt'
        then snap.relative_volume_20 is not null and snap.relative_volume_20 < (rule->>'value')::numeric
    when coalesce(rule->>'field', '') = 'up_sequence_count' and coalesce(rule->>'operator', '') = 'gte'
        then snap.up_sequence_count >= (rule->>'value')::integer
    when coalesce(rule->>'field', '') = 'down_sequence_count' and coalesce(rule->>'operator', '') = 'gte'
        then snap.down_sequence_count >= (rule->>'value')::integer
    when coalesce(rule->>'field', '') = 'up_sequence_break_bars_ago' and coalesce(rule->>'operator', '') = 'lte'
        then snap.up_sequence_break_bars_ago is not null and snap.up_sequence_break_bars_ago <= (rule->>'value')::integer
    when coalesce(rule->>'field', '') = 'down_sequence_break_bars_ago' and coalesce(rule->>'operator', '') = 'lte'
        then snap.down_sequence_break_bars_ago is not null and snap.down_sequence_break_bars_ago <= (rule->>'value')::integer
    when coalesce(rule->>'field', '') = 'fib_zone' and coalesce(rule->>'operator', '') = 'eq'
        then case coalesce(rule->>'value', '')
            when '0_382' then snap.fib_zone_0_382
            when '382_500' then snap.fib_zone_382_500
            when '500_618' then snap.fib_zone_500_618
            when '618_786' then snap.fib_zone_618_786
            when '786_100' then snap.fib_zone_786_100
            else false
        end
    else false
end;
$$;

drop function if exists public.run_screener_v1(jsonb, integer, integer, text, text);

create or replace function public.run_screener_v1(
    payload jsonb,
    result_limit integer default 50,
    result_offset integer default 0,
    sort_key text default 'ticker',
    sort_dir text default 'asc'
) returns table (
    ticker text,
    timeframe text,
    market text,
    last_trade_date date,
    close numeric,
    pct_to_bb_upper numeric,
    pct_to_bb_lower numeric,
    atr_14 numeric,
    atr_percent numeric,
    rsi_14 numeric,
    relative_volume_20 numeric,
    is_up_day boolean,
    bullish_sequence_active boolean,
    bearish_sequence_active boolean,
    strong_up_sequence_context boolean,
    strong_down_sequence_context boolean,
    up_sequence_count integer,
    down_sequence_count integer,
    up_sequence_break_bars_ago integer,
    down_sequence_break_bars_ago integer,
    up_sequence_broke_recently boolean,
    down_sequence_broke_recently boolean,
    down_sequence_broke_in_strong_up_context boolean,
    up_sequence_broke_in_strong_down_context boolean,
    buy_signal boolean,
    sell_signal boolean,
    strong_buy_signal boolean,
    strong_sell_signal boolean,
    is_above_sma20 boolean,
    is_below_sma20 boolean,
    is_above_sma50 boolean,
    is_below_sma50 boolean,
    is_above_sma150 boolean,
    is_below_sma150 boolean,
    is_above_sma200 boolean,
    is_below_sma200 boolean
)
language sql
stable
as $$
with rules as (
    select value as rule
    from jsonb_array_elements(coalesce(payload->'rules', '[]'::jsonb))
),
filtered as (
    select
        d.ticker,
        d.timeframe,
        d.market,
        d.last_trade_date,
        d.close,
        d.pct_to_bb_upper,
        d.pct_to_bb_lower,
        d.atr_14,
        d.atr_percent,
        d.rsi_14,
        d.relative_volume_20,
        d.is_up_day,
        d.bullish_sequence_active,
        d.bearish_sequence_active,
        d.strong_up_sequence_context,
        d.strong_down_sequence_context,
        d.up_sequence_count,
        d.down_sequence_count,
        d.up_sequence_break_bars_ago,
        d.down_sequence_break_bars_ago,
        d.up_sequence_broke_recently,
        d.down_sequence_broke_recently,
        d.down_sequence_broke_in_strong_up_context,
        d.up_sequence_broke_in_strong_down_context,
        d.buy_signal,
        d.sell_signal,
        d.strong_buy_signal,
        d.strong_sell_signal,
        d.is_above_sma20,
        d.is_below_sma20,
        d.is_above_sma50,
        d.is_below_sma50,
        d.is_above_sma150,
        d.is_below_sma150,
        d.is_above_sma200,
        d.is_below_sma200
    from public.symbol_indicator_snapshot d
    left join public.symbol_indicator_snapshot w
        on w.ticker = d.ticker
       and w.timeframe = '1W'
    left join public.symbol_indicator_snapshot m
        on m.ticker = d.ticker
       and m.timeframe = '1M'
    left join public.symbol_metadata md
        on md.ticker = d.ticker
    where d.timeframe = '1D'
      and (
        coalesce(payload->>'listing_market', '') = ''
        or d.market = payload->>'listing_market'
      )
      and (
        payload->>'market_cap_gte' is null
        or (md.market_cap is not null and md.market_cap >= (payload->>'market_cap_gte')::numeric)
      )
      and (
        payload->>'market_cap_lte' is null
        or (md.market_cap is not null and md.market_cap <= (payload->>'market_cap_lte')::numeric)
      )
      and not exists (
        select 1
        from rules
        where not (
            case coalesce(rule->>'timeframe', '1D')
                when '1D' then public.screener_rule_matches(rule, d)
                when '1W' then coalesce(public.screener_rule_matches(rule, w), false)
                when '1M' then coalesce(public.screener_rule_matches(rule, m), false)
                else false
            end
        )
      )
)
select *
from filtered
order by
    case when sort_key = 'ticker' and sort_dir = 'asc' then ticker end asc,
    case when sort_key = 'ticker' and sort_dir = 'desc' then ticker end desc,
    case when sort_key = 'close' and sort_dir = 'asc' then close end asc nulls last,
    case when sort_key = 'close' and sort_dir = 'desc' then close end desc nulls last,
    case when sort_key = 'atr_percent' and sort_dir = 'asc' then atr_percent end asc nulls last,
    case when sort_key = 'atr_percent' and sort_dir = 'desc' then atr_percent end desc nulls last,
    ticker asc
limit greatest(result_limit, 0)
offset greatest(result_offset, 0);
$$;
