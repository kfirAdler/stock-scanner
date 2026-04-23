alter table public.symbol_metadata
  add column if not exists listing_exchange text;

comment on column public.symbol_metadata.listing_exchange is
  'TradingView-style venue prefix: NYSE, NASDAQ, AMEX, BATS (resolved from Yahoo or yfinance).';
