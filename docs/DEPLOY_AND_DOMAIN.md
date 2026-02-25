# Deploy & Custom Domain

## 1. Stop "cursoragent" showing as contributor

Cursor can create commits with **cursoragent** / **Cursor Agent** as author. To fix:

**Option A – Only your machine:** Ensure all future commits use your identity:

```bash
git config user.name "cryptoduke01"
git config user.email "egbolucheakachukwu@gmail.com"
```

**Option B – Rewrite history so cursoragent is replaced by you:**  
Run from repo root (replace with your name/email):

```bash
git filter-branch -f --env-filter '
export GIT_AUTHOR_NAME="cryptoduke01"
export GIT_AUTHOR_EMAIL="egbolucheakachukwu@gmail.com"
export GIT_COMMITTER_NAME="cryptoduke01"
export GIT_COMMITTER_EMAIL="egbolucheakachukwu@gmail.com"
' --tag-name-filter cat -- --branches --tags
```

Then force-push (this rewrites history):

```bash
git push --force origin main
```

After that, only **cryptoduke01** will show as contributor. Use Option B only if you’re fine rewriting history and no one else has cloned the repo yet.

---

## 2. Deploy frontend (Next.js) to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New Project** → import the **siren** repo.
3. **Configure:**
   - **Root Directory:** `apps/web`
   - **Framework:** Next.js (auto-detected)
   - **Build Command:** `pnpm build` (or leave default)
   - **Install Command:** `pnpm install`
   - **Root Directory:** set to `apps/web` (Vercel will run commands from repo root by default; you may need to set **Root Directory** to `apps/web` and then override **Build** to run from root: e.g. `cd ../.. && pnpm install && pnpm --filter web build` — or use Vercel’s monorepo support and set root to repo root and build command `pnpm --filter web build`).

   Easiest: set **Root Directory** to `apps/web`. Then in **Settings → General**, set **Build Command** to `pnpm build` and **Install Command** to `pnpm install` (Vercel will `cd` into `apps/web` automatically when Root Directory is set).

4. **Environment variables** (Settings → Environment Variables):
   - `NEXT_PUBLIC_API_URL` = `https://your-api-domain.com` (your backend URL; set after deploying API)
   - `NEXT_PUBLIC_SOLANA_RPC_URL` = your Helius RPC URL (optional but recommended)

5. Deploy. Your app will be at `https://siren-xxx.vercel.app` (or your project name).

---

## 3. Deploy backend (Fastify API) – Railway or Render

Vercel is best for the Next.js app. Run the Fastify API on **Railway** or **Render** (both have free tiers and deploy from GitHub).

### Railway

1. Go to [railway.app](https://railway.app), sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select **siren**.
3. **Settings:**
   - **Root Directory:** `apps/api`
   - **Build Command:** `pnpm install && pnpm build` (or `cd apps/api && pnpm install && pnpm build` if root is repo root)
   - **Start Command:** `node dist/index.js` or `pnpm start`
   - **Watch Paths:** `apps/api/**`

4. **Variables:** Add the same keys as in `apps/api/.env` (e.g. `PORT`, `BAGS_API_KEY`, `JUPITER_API_KEY`, `DATABASE_URL`, `REDIS_URL`, etc.). Do **not** paste `.env` in public; use the dashboard.

5. **Postgres / Redis:** In Railway you can add Postgres and Redis from the dashboard and wire `DATABASE_URL` and `REDIS_URL` to this service.

6. After deploy, note the public URL (e.g. `https://siren-api-production-xxx.up.railway.app`). Use it as `NEXT_PUBLIC_API_URL` in Vercel.

### Render (alternative)

1. Go to [render.com](https://render.com), sign in with GitHub.
2. **New → Web Service** → connect **siren** repo.
3. **Settings:**
   - **Root Directory:** `apps/api`
   - **Build Command:** `pnpm install && pnpm build`
   - **Start Command:** `pnpm start` or `node dist/index.js`

4. Add **Environment** variables (same as `.env`).
5. Optional: add **PostgreSQL** and **Redis** from Render dashboard and use their URLs.

---

## 4. Wire frontend to backend

1. After the API is live, copy its URL (e.g. `https://siren-api.railway.app`).
2. In **Vercel** → your project → **Settings → Environment Variables**, set:
   - `NEXT_PUBLIC_API_URL` = `https://your-api-url`
3. Redeploy the frontend so it uses the new API URL.

---

## 5. Custom domain (Vercel + backend)

### Frontend (Vercel)

1. Vercel project → **Settings → Domains**.
2. Add your domain (e.g. `siren.xyz` or `app.siren.xyz`).
3. Follow Vercel’s DNS instructions (add the CNAME or A record they give you at your registrar).
4. After DNS propagates, Vercel will issue SSL and the app will be live on your domain.

### Backend (Railway / Render)

- **Railway:** **Settings → Domains** → **Generate Domain** or **Custom Domain**. Add a CNAME from e.g. `api.siren.xyz` to the value Railway shows. Add `api.siren.xyz` in Railway.
- **Render:** **Settings → Custom Domain** → add e.g. `api.siren.xyz` and add the CNAME record they show at your DNS.

### Summary

| What        | Where     | Domain example   |
|------------|-----------|------------------|
| Next.js    | Vercel    | `siren.xyz` or `app.siren.xyz` |
| Fastify API | Railway / Render | `api.siren.xyz` |

Set `NEXT_PUBLIC_API_URL=https://api.siren.xyz` (or your real API domain) in Vercel so the frontend talks to your API on your domain.
