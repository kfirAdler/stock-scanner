alter table public.symbol_indicator_snapshot
    add column if not exists fib_swing_side text,
    add column if not exists fib_swing_low numeric,
    add column if not exists fib_swing_high numeric,
    add column if not exists fib_level_382 numeric,
    add column if not exists fib_level_500 numeric,
    add column if not exists fib_level_618 numeric,
    add column if not exists fib_level_786 numeric,
    add column if not exists fib_zone_0_382 boolean not null default false,
    add column if not exists fib_zone_382_500 boolean not null default false,
    add column if not exists fib_zone_500_618 boolean not null default false,
    add column if not exists fib_zone_618_786 boolean not null default false,
    add column if not exists fib_zone_786_100 boolean not null default false;

create index if not exists idx_snapshot_timeframe_ticker
    on public.symbol_indicator_snapshot (timeframe, ticker);

create index if not exists idx_snapshot_timeframe_market_trade_date
    on public.symbol_indicator_snapshot (timeframe, market, last_trade_date desc);

create index if not exists idx_symbol_metadata_market_cap
    on public.symbol_metadata (market_cap);

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

create or replace function public.run_screener_v1(payload jsonb)
returns setof public.symbol_indicator_snapshot
language sql
stable
as $$
with rules as (
    select value as rule
    from jsonb_array_elements(coalesce(payload->'rules', '[]'::jsonb))
)
select d.*
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
order by d.ticker asc
limit 500;
$$;
