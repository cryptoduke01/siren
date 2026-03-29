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

**Status:** Mintlify docs in separate repo. Deploy to Mintlify or similar; point `docs.onsiren.xyz` to it.

---

## 3. Privy Auth (login + embedded wallets)

**Status:** Integrated. When `NEXT_PUBLIC_PRIVY_APP_ID` is set, the app uses Privy for social sign-in (Google, GitHub, X) and creates embedded Solana + EVM wallets automatically.

**Your steps:**
1. In **apps/web/.env.local** add:
   ```
   NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
   ```
   (Get App ID from [dashboard.privy.io](https://dashboard.privy.io))
2. **Privy dashboard** — set allowed origins (e.g. `https://onsiren.xyz`, `http://localhost:3000`)
3. Enable **Google, GitHub, X** and **Embedded wallets**.
4. Turn on **Solana** and **Ethereum** wallet creation on login (all users). Siren defaults the EVM side to Base / Ethereum / Polygon in-app.

---

## 4. Supabase (waitlist)

- **Waitlist:** `waitlist_signups` table. Access codes in `access_code` column.
- **Users:** `users` table for app users (wallet + auth_user_id + signup_source).

---

## 5. Deployment checklist

| Service        | Env vars / config |
|----------------|-------------------|
| API (Render)   | `RESEND_API_KEY`, `SIREN_EMAIL_FROM`, `SIREN_APP_URL`, `SUPABASE_*`, `SIREN_ACCESS_CODE`, `REDIS_URL`, DFlow/Bags/Jupiter keys, Polymarket keys |
| Web (Vercel)   | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_ADMIN_PASSCODE` |

---

## Quick commands

```bash
pnpm dev:api      # API on :4000
pnpm dev:web      # Web on :3000
```
