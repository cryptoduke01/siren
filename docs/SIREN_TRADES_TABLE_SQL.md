## `siren_trades` table (Supabase) - required for permanent trade logging

Run this in your Supabase SQL editor.

```sql
create extension if not exists pgcrypto;

create table if not exists public.siren_trades (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  mint text not null,
  side text not null check (side in ('buy', 'sell')),
  token_amount double precision,
  price_usd double precision,
  token_name text,
  token_symbol text,
  tx_signature text,
  executed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists siren_trades_wallet_idx on public.siren_trades(wallet);
create index if not exists siren_trades_mint_idx on public.siren_trades(mint);
create index if not exists siren_trades_executed_at_idx on public.siren_trades(executed_at);
```

This table is used by `POST /api/trades/log` from the app after swaps.

