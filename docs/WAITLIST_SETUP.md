# Waitlist Setup (Supabase)

## 1. Create the table

In **Supabase → SQL Editor**, run:

```sql
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  wallet text,
  name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_waitlist_signups_created_at
  on public.waitlist_signups (created_at desc);
```

If the table already exists without `unique`, add it: `alter table public.waitlist_signups add constraint waitlist_signups_email_key unique (email);`

## 2. API env vars

In `apps/api/.env`:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # from Settings → API → service_role (secret)
```

Use the **service_role** key, not the anon/publishable key.

## 3. Test

1. Run API + web.
2. Visit `/waitlist`, submit the form.
3. Check Supabase → Table Editor → `waitlist_signups`.
4. Visit `/admin`, enter passcode `180476`, view signups.

## 4. Access code (production)

On `onsiren.xyz`, terminal routes (`/`, `/portfolio`, etc.) require an access code. Set **`SIREN_ACCESS_CODE`** in **`apps/api/.env`** (the main API env). The web app validates via `POST /api/access/validate`; users who click “Go to terminal” or any nav link are sent to `/access` to enter the code.

**Force the gate on Vercel:** Add **`SIREN_GATE_ENABLED=true`** to your **web** app env on Vercel. This makes the terminal gate run on any host.
