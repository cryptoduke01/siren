# Siren — Where You Need to Step In

This guide tells you exactly what to configure and deploy. Everything else is done.

---

## 1. Access code + welcome email (Resend)

**Status:** Implemented. When you generate a code in admin, the API emails it to the user with a welcome + usage guide.

**Your steps:**
1. Go to [resend.com](https://resend.com) → Sign up → Create API key
2. Add your domain (e.g. `onsiren.xyz`) in Resend → Domains → Verify
3. In `apps/api/.env` add:
   ```
   RESEND_API_KEY=re_xxxx
   SIREN_EMAIL_FROM=Siren <hello@onsiren.xyz>
   SIREN_APP_URL=https://onsiren.xyz
   ```
4. Restart the API

---

## 2. Docs site (docs.onsiren.xyz)

**Status:** Scaffolded in `apps/docs`. User docs: Introduction, Getting started, Terminal, Portfolio, Launch, Account.

**Your steps:**
1. Deploy `apps/docs` to Vercel (or similar)
2. Set root directory to `apps/docs`
3. Add custom domain `docs.onsiren.xyz` in Vercel project settings
4. Run `pnpm build:docs` to verify

---

## 3. Dynamic Auth (OAuth + embedded wallets)

**Status:** Integrated. When `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` is set, the app uses Dynamic for connect/sign-in and creates embedded wallets for social logins.

**Your steps:**
1. In **apps/web/.env.local** add:
   ```
   NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=25509e6b-c386-4ba7-a640-c344b809d5fe
   ```
2. **Dynamic dashboard** (dashboard.dynamic.xyz) — required for embedded wallets:
   - **CORS:** Set CORS origin to your app URL (e.g. `https://onsiren.xyz` and `http://localhost:3000` for dev). Without this, embedded wallets will not work.
   - **Cookie-Based Authentication Domain:** Add your app domain (e.g. `onsiren.xyz` or `app.onsiren.xyz`) so Dynamic can manage sessions.
   - **Global Wallet Domain:** Add the domain Dynamic gives you for the embedded wallet pop-up, or use Dynamic’s default.
3. **MFA (optional):** Leave off for now, or enable later:
   - **Authenticator Apps (TOTP):** Google Auth, Authy, etc.
   - **Passkeys:** Device or password-manager credentials.
   You can enable one or both when you want stronger account security.
4. In Dynamic dashboard, enable **Google, GitHub, Twitter** under Login methods and **Embedded wallets** (create on login: all users).

---

## 4. Supabase (existing)

- **OAuth:** Supabase Auth with Google/GitHub/X. Configure providers in Supabase Dashboard → Authentication.
- **Waitlist:** `waitlist_signups` table. Access codes live in `access_code` column.
- **Users:** `users` table for app users (wallet + auth_user_id + signup_source).

---

## 5. Deployment checklist

| Service        | Env vars / config |
|----------------|-------------------|
| API            | `RESEND_API_KEY`, `SIREN_EMAIL_FROM`, `SIREN_APP_URL`, `SUPABASE_*`, `SIREN_ACCESS_CODE`, DFlow/Bags/Jupiter keys |
| Web            | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` (optional: `NEXT_PUBLIC_SUPABASE_*` if keeping Supabase OAuth) |
| Docs           | Deploy `apps/docs`; add `docs.onsiren.xyz` domain |

---

## Quick commands

```bash
pnpm dev:api      # API on :4000
pnpm dev:web      # Web on :3000
pnpm dev:docs     # Docs on :3001
pnpm build:docs   # Build docs for deploy
```
