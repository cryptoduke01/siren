-- Unified wallet activity ledger for Siren portfolio/activity/volume tracking.
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.siren_activity_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  event_key text not null unique,
  activity_kind text not null check (activity_kind in ('prediction', 'swap', 'token', 'send', 'receive', 'close', 'volume')),
  source text not null default 'app',
  side text check (side in ('buy', 'sell')),
  mint text,
  sol_amount double precision,
  token_amount double precision,
  price_usd double precision,
  stake_usd double precision,
  amount_usd double precision,
  volume_sol double precision,
  volume_usd double precision,
  token_name text,
  token_symbol text,
  from_symbol text,
  to_symbol text,
  counterparty text,
  note text,
  tx_signature text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists siren_activity_wallet_idx
  on public.siren_activity_ledger (wallet);

create index if not exists siren_activity_occurred_at_idx
  on public.siren_activity_ledger (occurred_at desc);

create index if not exists siren_activity_tx_signature_idx
  on public.siren_activity_ledger (tx_signature);

create index if not exists siren_activity_kind_idx
  on public.siren_activity_ledger (activity_kind, occurred_at desc);
