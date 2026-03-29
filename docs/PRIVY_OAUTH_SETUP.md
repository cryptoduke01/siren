# Privy OAuth Setup (Google, GitHub, X)

To enable sign-in with Google, GitHub, and X (Twitter) on Siren, configure OAuth credentials in both the provider consoles and the Privy dashboard.

**Important:** Privy uses a **single callback URL** for all providers. Add this **exact** URL in Google, GitHub, and X:

```
https://auth.privy.io/api/v1/oauth/callback
```

- No `/google`, `/github`, or `/twitter` suffix — same URL for all three.
- No trailing slash.
- Must be `https` (not `http`).

---

## 1. Privy Dashboard

1. Go to [dashboard.privy.io](https://dashboard.privy.io) and select your app.
2. Open **Login Methods** and enable **Google**, **GitHub**, and **Twitter (X)**.
3. Add **Client ID** and **Client Secret** from each provider (from steps 2–4 below).
4. In **Settings → Domains**, add `https://onsiren.xyz` and `http://localhost:3000` to **Allowed origins**.

---

## 2. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**.
2. Create **OAuth client ID** (or edit existing) → Application type: **Web application**.
3. **Authorized redirect URIs** (this is the critical one — Google redirects here after login):
   - Click **ADD URI** and paste **exactly**: `https://auth.privy.io/api/v1/oauth/callback`
   - No trailing slash, no extra spaces.
4. **Authorized JavaScript origins** (where requests come from):
   - Add `https://onsiren.xyz` and `http://localhost:3000`
5. Save. Copy **Client ID** and **Client Secret** → paste into Privy.

**Troubleshooting `redirect_uri_mismatch`:**

- Confirm you used **Authorized redirect URIs**, not only **Authorized JavaScript origins** — they are different.
- Ensure the URI is exactly `https://auth.privy.io/api/v1/oauth/callback` (no trailing slash).
- Changes can take 5–60 minutes to propagate. Try again after a short wait.
- Verify you’re using the OAuth client whose Client ID matches what’s in the Privy dashboard.

---

## 3. GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App** (or edit existing).
2. **Authorization callback URL:** Paste **exactly** `https://auth.privy.io/api/v1/oauth/callback` (no trailing slash).
3. **Homepage URL:** `https://onsiren.xyz`
4. Register / Update. Copy **Client ID** and **Client Secret** → paste into Privy.

---

## 4. X (Twitter) OAuth

1. Go to [X Developer Portal](https://developer.x.com) → your project → your app.
2. **User authentication settings** → enable **OAuth 2.0**.
3. **Callback URL:** Add **exactly**:
   ```
   https://auth.privy.io/api/v1/oauth/callback
   ```
4. **Website URL:** `https://onsiren.xyz`
5. Save and copy **Client ID** and **Client Secret** → paste into Privy.

---

## 5. Web App

Set `NEXT_PUBLIC_PRIVY_APP_ID` in your web env (Vercel, `.env.local`). The app uses Privy as the only sign-in surface:

1. **Social login only** — Google, GitHub, or X
2. **Embedded wallets on login** — Privy creates Solana plus EVM wallets for the user automatically

Privy login methods in `providers.tsx`: `["google", "github", "twitter"]`.
