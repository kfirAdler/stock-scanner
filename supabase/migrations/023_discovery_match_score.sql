-- Goal-based discovery is calculated at read time from the existing snapshots.
-- This migration adds no table, column, persisted score, or refresh work.

create or replace function public.discovery_match_score_v1(
    goal text,
    daily_snap public.symbol_indicator_snapshot,
    weekly_snap public.symbol_indicator_snapshot,
    monthly_snap public.symbol_indicator_snapshot
) returns integer
language sql
immutable
as $$
select case goal
    when 'trend_leaders' then
          case when coalesce(daily_snap.is_above_sma20, false) then 5 else 0 end
        + case when coalesce(daily_snap.is_above_sma50, false) then 10 else 0 end
        + case when coalesce(daily_snap.is_above_sma150, false) then 10 else 0 end
        + case when coalesce(daily_snap.is_above_sma200, false) then 10 else 0 end
        + case when coalesce(daily_snap.bullish_sequence_active, false) then 5 else 0 end
        + case when coalesce(daily_snap.strong_up_sequence_context, false) then 5 else 0 end
        + case when coalesce(weekly_snap.is_above_sma50, false) then 7 else 0 end
        + case when coalesce(weekly_snap.is_above_sma150, false) then 7 else 0 end
        + case when coalesce(weekly_snap.is_above_sma200, false) then 8 else 0 end
        + case when coalesce(weekly_snap.bullish_sequence_active, false) then 4 else 0 end
        + case when coalesce(weekly_snap.strong_up_sequence_context, false) then 4 else 0 end
        + case when coalesce(monthly_snap.is_above_sma150, false) then 4 else 0 end
        + case when coalesce(monthly_snap.is_above_sma200, false) then 5 else 0 end
        + case when coalesce(monthly_snap.bullish_sequence_active, false) then 3 else 0 end
        + case when coalesce(monthly_snap.strong_up_sequence_context, false) then 3 else 0 end
        + case when coalesce(daily_snap.is_new_high_50, false) then 4 else 0 end
        + case
            when daily_snap.rsi_14 between 50 and 75 then 3
            when daily_snap.rsi_14 between 40 and 80 then 1
            else 0
          end
        + case
            when daily_snap.relative_volume_20 >= 1.5 then 3
            when daily_snap.relative_volume_20 >= 1 then 1
            else 0
          end

    when 'confirmed_breakout' then
          case when coalesce(daily_snap.is_above_sma20, false) then 4 else 0 end
        + case when coalesce(daily_snap.is_above_sma50, false) then 6 else 0 end
        + case when coalesce(daily_snap.is_above_sma150, false) then 6 else 0 end
        + case when coalesce(daily_snap.is_above_sma200, false) then 6 else 0 end
        + case when coalesce(weekly_snap.is_above_sma50, false) then 4 else 0 end
        + case when coalesce(weekly_snap.is_above_sma200, false) then 4 else 0 end
        + case when coalesce(monthly_snap.is_above_sma200, false) then 5 else 0 end
        + case when coalesce(daily_snap.is_new_high_50, false) then 18 else 0 end
        + case when coalesce(daily_snap.is_up_day, false) then 5 else 0 end
        + case
            when coalesce(daily_snap.strong_buy_signal, false) then 12
            when coalesce(daily_snap.buy_signal, false) then 8
            when coalesce(daily_snap.down_sequence_broke_recently, false) then 6
            else 0
          end
        + case
            when daily_snap.relative_volume_20 >= 2 then 20
            when daily_snap.relative_volume_20 >= 1.5 then 16
            when daily_snap.relative_volume_20 >= 1.2 then 10
            when daily_snap.relative_volume_20 >= 1 then 5
            else 0
          end
        + case
            when daily_snap.rsi_14 between 50 and 75 then 6
            when daily_snap.rsi_14 between 45 and 80 then 3
            else 0
          end
        + case
            when daily_snap.atr_percent <= 5 then 4
            when daily_snap.atr_percent <= 8 then 2
            else 0
          end

    when 'healthy_pullback' then
          case when coalesce(daily_snap.is_above_sma50, false) then 7 else 0 end
        + case when coalesce(daily_snap.is_above_sma150, false) then 7 else 0 end
        + case when coalesce(daily_snap.is_above_sma200, false) then 7 else 0 end
        + case when coalesce(weekly_snap.is_above_sma50, false) then 4 else 0 end
        + case when coalesce(weekly_snap.is_above_sma150, false) then 4 else 0 end
        + case when coalesce(weekly_snap.is_above_sma200, false) then 5 else 0 end
        + case when coalesce(monthly_snap.is_above_sma150, false) then 5 else 0 end
        + case when coalesce(monthly_snap.is_above_sma200, false) then 6 else 0 end
        + case
            when coalesce(daily_snap.is_below_sma20, false)
             and coalesce(daily_snap.is_above_sma50, false) then 12
            when coalesce(daily_snap.is_above_sma20, false)
             and coalesce(daily_snap.is_above_sma50, false) then 5
            else 0
          end
        + case when coalesce(daily_snap.bearish_sequence_active, false) then 8 else 0 end
        + case
            when daily_snap.rsi_14 between 40 and 60 then 5
            when daily_snap.rsi_14 between 35 and 65 then 3
            else 0
          end
        + case
            when coalesce(daily_snap.strong_buy_signal, false) then 10
            when coalesce(daily_snap.buy_signal, false) then 8
            when coalesce(daily_snap.down_sequence_broke_recently, false) then 6
            else 0
          end
        + case when coalesce(daily_snap.is_up_day, false) then 5 else 0 end
        + case when coalesce(daily_snap.strong_up_sequence_context, false) then 5 else 0 end
        + case
            when daily_snap.atr_percent <= 3 then 10
            when daily_snap.atr_percent <= 5 then 7
            when daily_snap.atr_percent <= 8 then 3
            else 0
          end

    when 'stable_trend' then
          case when coalesce(daily_snap.is_above_sma20, false) then 5 else 0 end
        + case when coalesce(daily_snap.is_above_sma50, false) then 7 else 0 end
        + case when coalesce(daily_snap.is_above_sma150, false) then 7 else 0 end
        + case when coalesce(daily_snap.is_above_sma200, false) then 7 else 0 end
        + case when coalesce(weekly_snap.is_above_sma50, false) then 5 else 0 end
        + case when coalesce(weekly_snap.is_above_sma150, false) then 5 else 0 end
        + case when coalesce(weekly_snap.is_above_sma200, false) then 6 else 0 end
        + case when coalesce(monthly_snap.is_above_sma150, false) then 5 else 0 end
        + case when coalesce(monthly_snap.is_above_sma200, false) then 6 else 0 end
        + case when coalesce(daily_snap.strong_up_sequence_context, false) then 2 else 0 end
        + case
            when daily_snap.atr_percent <= 2 then 30
            when daily_snap.atr_percent <= 3 then 24
            when daily_snap.atr_percent <= 4 then 16
            when daily_snap.atr_percent <= 5 then 8
            else 0
          end
        + case
            when daily_snap.rsi_14 between 45 and 65 then 8
            when daily_snap.rsi_14 between 40 and 70 then 5
            when daily_snap.rsi_14 between 35 and 75 then 2
            else 0
          end
        + case
            when daily_snap.relative_volume_20 between 0.7 and 1.5 then 7
            when daily_snap.relative_volume_20 between 0.5 and 2 then 4
            else 0
          end

    when 'aggressive_rebound' then
          case
            when daily_snap.rsi_14 <= 25 then 30
            when daily_snap.rsi_14 <= 30 then 25
            when daily_snap.rsi_14 <= 35 then 15
            when daily_snap.rsi_14 <= 40 then 5
            else 0
          end
        + case
            when coalesce(daily_snap.strong_buy_signal, false) then 15
            when coalesce(daily_snap.buy_signal, false) then 12
            when coalesce(daily_snap.down_sequence_broke_recently, false) then 10
            else 0
          end
        + case when coalesce(daily_snap.is_up_day, false) then 8 else 0 end
        + case when coalesce(daily_snap.down_sequence_broke_in_strong_up_context, false) then 7 else 0 end
        + case when coalesce(daily_snap.strong_up_sequence_context, false) then 5 else 0 end
        + case
            when daily_snap.relative_volume_20 >= 2 then 20
            when daily_snap.relative_volume_20 >= 1.5 then 16
            when daily_snap.relative_volume_20 >= 1.2 then 10
            when daily_snap.relative_volume_20 >= 1 then 5
            else 0
          end
        + case when coalesce(daily_snap.is_above_sma200, false) then 5 else 0 end
        + case when coalesce(weekly_snap.is_above_sma200, false) then 5 else 0 end
        + case when coalesce(monthly_snap.is_above_sma200, false) then 5 else 0 end

    else null
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
    match_score integer,
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
        public.discovery_match_score_v1(payload->>'discovery_goal', d, w, m) as match_score,
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
    case when sort_key = 'match_score' and sort_dir = 'desc' then match_score end desc nulls last,
    case when sort_key = 'match_score' and sort_dir = 'asc' then match_score end asc nulls last,
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
