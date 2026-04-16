-- Canonical audience surface for Siren emails.
-- Safe to run multiple times in Supabase SQL editor or via `prisma db execute`.

alter table if exists public.users
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace view public.siren_contacts as
with waitlist_contacts as (
  select
    lower(trim(email)) as email,
    nullif(trim(name), '') as name,
    'waitlist'::text as source,
    array['waitlist']::text[] as source_labels,
    id as waitlist_id,
    null::uuid as app_user_id,
    case
      when wallet is not null and trim(wallet) <> '' then array[lower(trim(wallet))]
      else array[]::text[]
    end as wallets,
    null::text as signup_source,
    null::text as country,
    created_at,
    null::timestamptz as last_seen_at,
    access_code,
    access_code_used_at
  from public.waitlist_signups
  where email is not null
    and trim(email) <> ''
),
app_contacts as (
  select
    lower(trim(coalesce(metadata ->> 'email', metadata ->> 'contact_email', metadata ->> 'primary_email'))) as email,
    nullif(trim(coalesce(metadata ->> 'display_name', metadata ->> 'full_name', metadata ->> 'name', metadata ->> 'username')), '') as name,
    'app'::text as source,
    array['app']::text[] as source_labels,
    null::uuid as waitlist_id,
    id as app_user_id,
    case
      when wallet is not null and trim(wallet) <> '' then array[lower(trim(wallet))]
      else array[]::text[]
    end as wallets,
    signup_source,
    country,
    created_at,
    last_seen_at,
    null::text as access_code,
    null::timestamptz as access_code_used_at
  from public.users
  where coalesce(metadata ->> 'email', metadata ->> 'contact_email', metadata ->> 'primary_email') is not null
    and trim(coalesce(metadata ->> 'email', metadata ->> 'contact_email', metadata ->> 'primary_email')) <> ''
),
combined as (
  select * from waitlist_contacts
  union all
  select * from app_contacts
),
deduped as (
  select
    email,
    max(name) filter (where name is not null) as name,
    case
      when count(*) filter (where source = 'waitlist') > 0 and count(*) filter (where source = 'app') > 0 then 'both'
      when count(*) filter (where source = 'app') > 0 then 'app'
      else 'waitlist'
    end as source,
    array_remove(array[
      case when count(*) filter (where source = 'waitlist') > 0 then 'waitlist' end,
      case when count(*) filter (where source = 'app') > 0 then 'app' end
    ], null)::text[] as source_labels,
    max(waitlist_id) as waitlist_id,
    max(app_user_id) as app_user_id,
    array(
      select distinct wallet
      from combined c2,
      unnest(c2.wallets) as wallet
      where c2.email = combined.email
        and wallet is not null
        and trim(wallet) <> ''
      order by wallet
    ) as wallets,
    max(signup_source) filter (where signup_source is not null) as signup_source,
    max(country) filter (where country is not null) as country,
    min(created_at) as created_at,
    max(last_seen_at) as last_seen_at,
    max(access_code) filter (where access_code is not null) as access_code,
    max(access_code_used_at) filter (where access_code_used_at is not null) as access_code_used_at
  from combined
  group by email
)
select *
from deduped
order by coalesce(last_seen_at, created_at) desc, email asc;
