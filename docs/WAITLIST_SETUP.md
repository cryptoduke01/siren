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

**Access codes for waitlist users:** Add the column and unique index:

```sql
alter table public.waitlist_signups add column if not exists access_code text;
create unique index if not exists idx_waitlist_access_code
  on public.waitlist_signups (access_code) where access_code is not null;
```

**One-time use:** Codes are single-use. Add the tracking column:

```sql
alter table public.waitlist_signups add column if not exists access_code_used_at timestamptz;
```

Admins can generate per-user 6-digit codes from the admin panel. Users enter their code on `/access` to unlock the terminal. Each waitlist code can only be used once; after use, `access_code_used_at` is set. The master `SIREN_ACCESS_CODE` (env) still works for all users and is unlimited.

**Welcome emails:** When you generate a code, the API sends a welcome email (code + how to use Siren) if Resend is configured. In `apps/api/.env` add:
- `RESEND_API_KEY` — from [resend.com](https://resend.com/api-keys)
- `SIREN_EMAIL_FROM` — e.g. `Siren <hello@onsiren.xyz>` (verify the domain in Resend)
- `SIREN_APP_URL` — e.g. `https://onsiren.xyz`

## 2. API env vars

In `apps/api/.env`:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=   # from Settings → API → service_role (secret)
```

Use the **service_role** key, not the anon/publishable key.

## 3. Test

1. Run API + web.
2. Visit `/waitlist`, submit the form.
3. Check Supabase → Table Editor → `waitlist_signups`.
4. Visit `/admin`, enter your admin passcode (set `NEXT_PUBLIC_ADMIN_PASSCODE` in web env), view signups.

## 4. Access code (production)

On `onsiren.xyz`, terminal routes (`/`, `/portfolio`, etc.) require an access code. Set **`SIREN_ACCESS_CODE`** in **`apps/api/.env`** (the main API env). The web app validates via `POST /api/access/validate`; users who click “Go to terminal” or any nav link are sent to `/access` to enter the code.

**Force the gate on Vercel:** Add **`SIREN_GATE_ENABLED=true`** to your **web** app env on Vercel. This makes the terminal gate run on any host.
