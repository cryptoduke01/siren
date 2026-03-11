# Privy OAuth Setup (Google, GitHub, X)

To enable sign-in with Google, GitHub, and X (Twitter) on Siren, configure OAuth credentials in both the provider consoles and the Privy dashboard.

## 1. Privy Dashboard

1. Go to [dashboard.privy.io](https://dashboard.privy.io) and select your app.
2. Open **Login Methods** and enable **Google**, **GitHub**, and **Twitter (X)**.
3. For each provider, Privy shows:
   - **Redirect URI** — add this to your OAuth app in the provider's console
   - **Client ID** — from the provider, paste into Privy
   - **Client Secret** — from the provider, paste into Privy (keep secret)

---

## 2. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**.
2. Create a project or select an existing one.
3. Click **Create Credentials** → **OAuth client ID**.
4. Application type: **Web application**.
5. Name: e.g. `Siren`.
6. **Authorized redirect URIs:** Add the redirect URI from Privy (e.g. `https://auth.privy.io/api/v1/oauth/callback/google`).
7. Create and copy **Client ID** and **Client Secret**.
8. Paste both into Privy under Google settings.

---

## 3. GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.
2. **Application name:** Siren.
3. **Homepage URL:** `https://onsiren.xyz` (or your app URL).
4. **Authorization callback URL:** Use the redirect URI from Privy (e.g. `https://auth.privy.io/api/v1/oauth/callback/github`).
5. Register. Copy **Client ID** and generate **Client Secret**.
6. Paste both into Privy under GitHub settings.

---

## 4. X (Twitter) OAuth

1. Go to [X Developer Portal](https://developer.x.com) → your project → your app.
2. In **User authentication settings**, enable **OAuth 2.0**.
3. **Type of App:** Web App.
4. **Callback URL:** Use the redirect URI from Privy (e.g. `https://auth.privy.io/api/v1/oauth/callback/twitter`).
5. **Website URL:** `https://onsiren.xyz`.
6. Save and copy **Client ID** and **Client Secret**.
7. Paste both into Privy under Twitter/X settings.

---

## 5. Web App

Set `NEXT_PUBLIC_PRIVY_APP_ID` in your web env (Vercel, `.env.local`). The login methods are already configured in `apps/web/src/app/providers.tsx`:

```ts
loginMethods: ["wallet", "email", "google", "github", "twitter"],
```

After adding credentials in the Privy dashboard, the login modal will show Google, GitHub, and X options.
