create or replace function public.snapshot_to_result_json(
    snap public.symbol_indicator_snapshot
) returns jsonb
language sql
immutable
as $$
select case
    when snap is null then null
    else jsonb_build_object(
        'ticker', snap.ticker,
        'timeframe', snap.timeframe,
        'market', snap.market,
        'last_trade_date', snap.last_trade_date,
        'close', snap.close,
        'pct_to_bb_upper', snap.pct_to_bb_upper,
        'pct_to_bb_lower', snap.pct_to_bb_lower,
        'atr_14', snap.atr_14,
        'atr_percent', snap.atr_percent,
        'rsi_14', snap.rsi_14,
        'avg_volume_20', snap.avg_volume_20,
        'relative_volume_20', snap.relative_volume_20,
        'is_up_day', snap.is_up_day,
        'is_new_high_50', snap.is_new_high_50,
        'bullish_sequence_active', snap.bullish_sequence_active,
        'bearish_sequence_active', snap.bearish_sequence_active,
        'strong_up_sequence_context', snap.strong_up_sequence_context,
        'strong_down_sequence_context', snap.strong_down_sequence_context,
        'up_sequence_count', snap.up_sequence_count,
        'down_sequence_count', snap.down_sequence_count,
        'up_sequence_break_bars_ago', snap.up_sequence_break_bars_ago,
        'down_sequence_break_bars_ago', snap.down_sequence_break_bars_ago,
        'up_sequence_broke_recently', snap.up_sequence_broke_recently,
        'down_sequence_broke_recently', snap.down_sequence_broke_recently,
        'down_sequence_broke_in_strong_up_context', snap.down_sequence_broke_in_strong_up_context,
        'up_sequence_broke_in_strong_down_context', snap.up_sequence_broke_in_strong_down_context,
        'buy_signal', snap.buy_signal,
        'sell_signal', snap.sell_signal,
        'strong_buy_signal', snap.strong_buy_signal,
        'strong_sell_signal', snap.strong_sell_signal,
        'is_above_sma20', snap.is_above_sma20,
        'is_below_sma20', snap.is_below_sma20,
        'is_above_sma50', snap.is_above_sma50,
        'is_below_sma50', snap.is_below_sma50,
        'is_above_sma150', snap.is_above_sma150,
        'is_below_sma150', snap.is_below_sma150,
        'is_above_sma200', snap.is_above_sma200,
        'is_below_sma200', snap.is_below_sma200
    )
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
    avg_volume_20 numeric,
    relative_volume_20 numeric,
    is_up_day boolean,
    is_new_high_50 boolean,
    return_on_equity numeric,
    debt_to_equity numeric,
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
    is_below_sma200 boolean,
    weekly_snapshot jsonb,
    monthly_snapshot jsonb
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
        d.avg_volume_20,
        d.relative_volume_20,
        d.is_up_day,
        d.is_new_high_50,
        md.return_on_equity,
        md.debt_to_equity,
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
        d.is_below_sma200,
        public.snapshot_to_result_json(w) as weekly_snapshot,
        public.snapshot_to_result_json(m) as monthly_snapshot
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
            case
                when coalesce(rule->>'field', '') in ('return_on_equity', 'debt_to_equity')
                    then public.screener_metadata_rule_matches(rule, md)
                else case coalesce(rule->>'timeframe', '1D')
                    when '1D' then public.screener_rule_matches(rule, d)
                    when '1W' then coalesce(public.screener_rule_matches(rule, w), false)
                    when '1M' then coalesce(public.screener_rule_matches(rule, m), false)
                    else false
                end
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
