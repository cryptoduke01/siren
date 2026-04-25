-- Supabase RLS hardening for Siren app data.
-- Safe default: the backend uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Run this in Supabase SQL editor to remove "UNRESTRICTED" table exposure in the Data API.

alter table if exists public.users enable row level security;
alter table if exists public.waitlist_signups enable row level security;
alter table if exists public.siren_trades enable row level security;
alter table if exists public.siren_trade_attempts enable row level security;
alter table if exists public.siren_market_views enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'custodial_wallets'
  ) then
    execute 'alter table public.custodial_wallets enable row level security';
  end if;
end $$;

-- No anon/authenticated policies are added here on purpose.
-- With RLS enabled and no policies, browser/Data API access is denied by default.
-- The Siren API should continue working because it uses the service-role key server-side.
