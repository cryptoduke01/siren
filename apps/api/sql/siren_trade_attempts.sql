-- Trade attempt log for execution success-rate analysis.
-- Run in Supabase SQL editor.

create table if not exists public.siren_trade_attempts (
  id uuid primary key default gen_random_uuid(),
  wallet text,
  venue text not null,
  mode text not null,
  market text,
  side text,
  input_asset text,
  output_asset text,
  amount text,
  status text not null,
  tx_signature text,
  error_message text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_siren_trade_attempts_created_at
  on public.siren_trade_attempts (created_at desc);

create index if not exists idx_siren_trade_attempts_wallet
  on public.siren_trade_attempts (wallet);

create index if not exists idx_siren_trade_attempts_market_status
  on public.siren_trade_attempts (market, status, created_at desc);
