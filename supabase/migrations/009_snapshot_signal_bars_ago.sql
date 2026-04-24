alter table public.symbol_indicator_snapshot
  add column if not exists strong_buy_signal_bars_ago integer,
  add column if not exists strong_sell_signal_bars_ago integer;

comment on column public.symbol_indicator_snapshot.strong_buy_signal_bars_ago is
  'Bars from last row to the bar where strong buy last fired (0 = current bar).';
comment on column public.symbol_indicator_snapshot.strong_sell_signal_bars_ago is
  'Bars from last row to the bar where strong sell last fired (0 = current bar).';
