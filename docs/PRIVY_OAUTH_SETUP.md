# Privy OAuth Setup (Google, GitHub, X)

To enable sign-in with Google, GitHub, and X (Twitter) on Siren, configure OAuth credentials in both the provider consoles and the Privy dashboard.

**Important:** Privy uses a **single callback URL** for all providers. Add this **exact** URL in Google, GitHub, and X:

```
https://auth.privy.io/api/v1/oauth/callback
```

(No `/google`, `/github`, or `/twitter` suffix — use this same URL for all three.)

---

## 1. Privy Dashboard

1. Go to [dashboard.privy.io](https://dashboard.privy.io) and select your app.
2. Open **Login Methods** and enable **Google**, **GitHub**, and **Twitter (X)**.
3. Add **Client ID** and **Client Secret** from each provider.
4. In **Settings → Domains**, add `https://onsiren.xyz` and `http://localhost:3000` to **Allowed origins**.

---

## 2. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**.
2. Create **OAuth client ID** → Application type: **Web application**.
3. **Authorized redirect URIs:** Add **exactly**:
   ```
   https://auth.privy.io/api/v1/oauth/callback
   ```
4. **Authorized JavaScript origins:** Add `https://onsiren.xyz` and `http://localhost:3000`.
5. Create and copy **Client ID** and **Client Secret** → paste into Privy.

---

## 3. GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.
2. **Authorization callback URL:** Add **exactly**:
   ```
   https://auth.privy.io/api/v1/oauth/callback
   ```
3. **Homepage URL:** `https://onsiren.xyz`
4. Register. Copy **Client ID** and **Client Secret** → paste into Privy.

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

Set `NEXT_PUBLIC_PRIVY_APP_ID` in your web env (Vercel, `.env.local`). The login methods are already configured in `apps/web/src/app/providers.tsx`:

```ts
loginMethods: ["wallet", "email", "google", "github", "twitter"],
```

After adding credentials in the Privy dashboard, the login modal will show Google, GitHub, and X options.
