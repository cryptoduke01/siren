# Getting Started

API keys, setup, and run instructions.

## 1. Get your API keys

### DFlow (Kalshi prediction markets on Solana)

- **What for:** Market discovery + trading (quotes, orders).
- **Endpoints:** Requests must use `e.quote-api.dflow.net` and `e.prediction-markets-api.dflow.net`; set `DFLOW_API_KEY` and `x-api-key` header. Keep the key server-side only.
- **Production key:** Use the [DFlow request form](https://pond.dflow.net) (or contact **hello@dflow.net**). For Siren, request:
  - **Project name:** Siren
  - **APIs:** Both **Swap API** and **Prediction Markets API**
  - **X / website:** Add when ready (e.g. “Yet to setup” is fine)
  - **Rate limits / traffic:** Describe your expected usage (e.g. “MVP terminal, ~100–500 requests/day”)
  - **Contact:** Prefer Slack; or Telegram @DanJablonski. They typically reply in 2–5 days.
- **Where to set:** `DFLOW_API_KEY` in `apps/api/.env`.

**Docs:** https://pond.dflow.net | https://dflow.mintlify.app

**Compliance:** For prediction market **trading**, geo-fence US and [restricted Kalshi jurisdictions](https://pond.dflow.net/legal/prediction-market-compliance). Use `apps/api/src/lib/geo-fence.ts`; block when `shouldBlockByCountry(countryCode)` is true (e.g. from `Cf-Ipcountry` if using Cloudflare).

---

### Kalshi (optional — native exchange data)

- **What for:** Extra market data / WebSocket from Kalshi directly. Siren can run on DFlow-only.
- **How to get:**
  1. Go to **https://kalshi.com** → account → API / developer
  2. Generate API key (and secret if required)
- **Where to set:** `KALSHI_API_KEY` and `KALSHI_API_SECRET` in `apps/api/.env`.
- **Optional:** Leave blank to use only DFlow.

**Docs:** https://docs.kalshi.com

---

### Twitter / X (optional — CT signal layer)

- **What for:** Mention velocity for tokens (e.g. “$JPOW” + “fed meeting”).
- **How to get:**
  1. **https://developer.x.com** → sign in → create a project and app
  2. Subscribe to **Basic** ($100/mo) for search/tweets API
  3. Generate **Bearer Token**
- **Where to set:** `TWITTER_BEARER_TOKEN` in `apps/api/.env`.
- **Optional:** Leave blank; CT layer can be mocked or skipped.
- **Details:** See `docs/X_API_TOKEN_TWEETS.md` for token CT mentions.

---

## 2. Set up environment

### Backend (`apps/api`)

```bash
cd apps/api
cp .env.example .env
```

Edit `.env` and fill only what you have:

- **Minimum to run:** With `DFLOW_API_KEY` set, use production URLs (`e.prediction-markets-api.dflow.net`, `e.quote-api.dflow.net`). Without a key, you can try dev URLs for testing (rate-limited).
- **For real trading:** Set `DFLOW_API_KEY` and `JUPITER_API_KEY` (for Solana swaps).
- **For DB/Redis later:** Set `DATABASE_URL` and `REDIS_URL` when you add Postgres/Redis.
- **For waitlist:** Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Settings → API). Create the `waitlist_signups` table in the SQL editor; see `docs/WAITLIST_SETUP.md`.
- **For email sends:** Set `RESEND_API_KEY`, `SIREN_EMAIL_FROM`, and `SIREN_APP_URL` so access-code and audience campaigns can send correctly.
### Frontend (`apps/web`)

```bash
cd apps/web
cp .env.example .env.local
```

Defaults point to local API:

- `NEXT_PUBLIC_API_URL=http://localhost:4000`
- `NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws`
- `NEXT_PUBLIC_PRIVY_APP_ID=` (from dashboard.privy.io for login)

Change API/WS URLs when you deploy.

**Swaps & balance (production):** The default Solana RPC often returns `403 Access forbidden` or fails to fetch balances. Set **`NEXT_PUBLIC_SOLANA_RPC_URL`** on Vercel (e.g. `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`). Without this, swaps and portfolio balance will not work on the deployed site.

**OAuth (Google, GitHub, X):** See `docs/PRIVY_OAUTH_SETUP.md`.

---

## 3. Run and test

### Install

From the repo root:

```bash
pnpm install
```

### Run (no DB/Redis required for basic run)

**Terminal 1 — API:**

```bash
pnpm dev:api
```

You should see: `Siren API listening` on port 4000.

**Terminal 2 — Web:**

```bash
pnpm dev:web
```

Open **http://localhost:3000**.

### Quick API test (no keys)

With the API running:

```bash
# Health
curl http://localhost:4000/health

# Markets (from DFlow Prediction Markets API; requires DFLOW_API_KEY for production)
curl http://localhost:4000/api/markets

# Surfaced tokens (DexScreener + Jupiter enrichment)
curl "http://localhost:4000/api/tokens"
```

If `/health` returns `{"ok":true,...}` and `/api/markets` returns a list, you’re good. If DFlow rate-limits, add `DFLOW_API_KEY` and the `e.*` production URLs.

### Optional: Postgres + Redis

- **Postgres:** Set `DATABASE_URL` in `apps/api/.env`, then:

  ```bash
  pnpm db:push
  pnpm db:seed   # if you have a seed script
  ```

- **Redis:** Set `REDIS_URL` for velocity cache and BullMQ jobs when you add them.

---

## 4. Next steps (in order)

| Step | What to do |
|------|------------|
| **1. Run locally** | Get the app running with `pnpm dev:api` + `pnpm dev:web` and confirm markets load (with or without keys). |
| **2. Get DFlow key** | Request via [pond.dflow.net](https://pond.dflow.net); set `DFLOW_API_KEY` for production trading routes. |
| **3. Jupiter** | Add `JUPITER_API_KEY` for Solana swap quotes used by the unified buy flow. |
| **4. Unified buy** | DFlow for prediction outcomes; Jupiter for SPL routing — both wired in `UnifiedBuyPanel` + `/api/swap/order`. |
| **5. Builder / fees** | Optional: Kalshi builder referral on DFlow orders; optional Jupiter platform fee envs. |
| **6. CT layer (optional)** | `TWITTER_BEARER_TOKEN` for mention velocity on surfaced tokens. |
| **7. Portfolio + trending** | `/portfolio` and `/trending` use Helius + DexScreener data paths. |
| **8. Deploy** | Frontend on Vercel (`apps/web`), API on Render or similar; set env vars; document keys in `.env.example`. |

---

## 5. One-page cheat sheet

```bash
# 1. Env — real secrets go in .env (never commit .env)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit apps/api/.env and add your keys

# 2. Install
pnpm install

# 3. Run
pnpm dev:api    # terminal 1
pnpm dev:web    # terminal 2

# 4. Test API
curl http://localhost:4000/health
curl http://localhost:4000/api/markets

# 5. Open app
open http://localhost:3000
```

**Keys (set in `apps/api/.env` when you have them):**

- **DFlow:** Request via form (see above) → `DFLOW_API_KEY`
- **Kalshi:** kalshi.com → API → `KALSHI_API_KEY` + `KALSHI_PRIVATE_KEY` (RSA PEM)
- **Twitter:** developer.x.com → Basic → Bearer → `TWITTER_BEARER_TOKEN`

**Security:** Never commit `.env` (it’s in `.gitignore`). If any key was ever exposed (e.g. in chat or a screenshot), rotate it in the provider’s dashboard.
