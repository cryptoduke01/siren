-- Market view log for traction analytics.
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.siren_market_views (
  id uuid primary key default gen_random_uuid(),
  wallet text,
  venue text not null,
  market text not null,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists idx_siren_market_views_created_at
  on public.siren_market_views (created_at desc);

create index if not exists idx_siren_market_views_market
  on public.siren_market_views (market, created_at desc);

create index if not exists idx_siren_market_views_wallet
  on public.siren_market_views (wallet);
