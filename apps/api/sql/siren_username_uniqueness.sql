-- Enforce global, case-insensitive username uniqueness for Siren users.
-- Run in Supabase SQL editor after reviewing any duplicate rows reported below.

update public.users
set username = lower(btrim(username))
where username is not null
  and btrim(username) <> ''
  and username <> lower(btrim(username));

-- Optional review query: if this returns rows, resolve them before re-running this file.
select
  lower(btrim(username)) as canonical_username,
  count(*) as duplicate_count,
  array_agg(id order by created_at asc) as user_ids,
  array_agg(wallet order by created_at asc) as wallets
from public.users
where username is not null
  and btrim(username) <> ''
group by lower(btrim(username))
having count(*) > 1;

do $$
begin
  if exists (
    select 1
    from public.users
    where username is not null
      and btrim(username) <> ''
    group by lower(btrim(username))
    having count(*) > 1
  ) then
    raise exception 'Duplicate usernames exist in public.users. Resolve them before creating the unique index.';
  end if;
end $$;

create unique index if not exists users_username_unique_idx
  on public.users ((lower(btrim(username))))
  where username is not null
    and btrim(username) <> '';
