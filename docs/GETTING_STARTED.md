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

### Bags (meme token launch + trade)

- **What for:** Token trade quotes, launch flow, partner fees.
- **How to get:**
  1. Go to **https://dev.bags.fm**
  2. Sign up / log in
  3. Create an API key in the dashboard
- **Where to set:** `BAGS_API_KEY` in `apps/api/.env`.
- **Note:** Without this key, token **surfacing** uses mock data; **trading** and **launch** need the key.
- **Fee claiming:** Portfolio shows claimable Bags fee share and lets users claim. See `docs/BAGS_FEE_CLAIMING.md`.

**Docs:** https://docs.bags.fm

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

### Polymarket

- **What for:** Parallel signal sourcing alongside Kalshi. Siren reads active markets from Gamma, checks the CLOB book for flagged moves, and pushes Polymarket signals into the same live queue.
- **What is live in Siren now:** Mixed-source market browsing, source-labeled signals, Privy social login, embedded Solana + EVM wallets, and the shared token-matching rail.
- **How to get:**
  1. Go to **https://polymarket.com** and create / retrieve API credentials
  2. Copy your **API key**, **secret**, and **passphrase**
- **Where to set:** `POLYMARKET_API_KEY`, `POLYMARKET_SECRET`, `POLYMARKET_PASSPHRASE`, and `POLYMARKET_HOST` in `apps/api/.env`
- **Default host:** `https://clob.polymarket.com`

**Docs:** https://docs.polymarket.com

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
- **For real trading:** Set `DFLOW_API_KEY` and `BAGS_API_KEY`.
- **For dual-source signals:** Set the Polymarket env vars and `REDIS_URL` so Siren can persist 60-second snapshots and the shared signal queue.
- **For waitlist:** Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Settings → API). Create the `waitlist_signups` table in the SQL editor; see `docs/WAITLIST_SETUP.md`.
### Frontend (`apps/web`)

```bash
cd apps/web
cp .env.example .env.local
```

Defaults point to local API:

- `NEXT_PUBLIC_API_URL=http://localhost:4000`
- `NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws`
- `NEXT_PUBLIC_PRIVY_APP_ID=` (from dashboard.privy.io for Google, GitHub, and X login)

Change API/WS URLs when you deploy.

**Swaps & balance (production):** The default Solana RPC often returns `403 Access forbidden` or fails to fetch balances. Set **`NEXT_PUBLIC_SOLANA_RPC_URL`** on Vercel (e.g. `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`). Without this, swaps and portfolio balance will not work on the deployed site.

**OAuth (Google, GitHub, X):** See `docs/PRIVY_OAUTH_SETUP.md`.

**Kalshi KYC:** Portfolio visibility works without it, but executing Kalshi market trades requires Kalshi KYC/compliance approval before those orders can clear.

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

# Signals (Kalshi + Polymarket feed)
curl http://localhost:4000/api/signals

# Surfaced tokens (mock data if no Bags key)
curl "http://localhost:4000/api/tokens"
```

If `/health` returns `{"ok":true,...}` and `/api/markets` returns a list, you’re good. If DFlow rate-limits, add `DFLOW_API_KEY` and the `e.*` production URLs.

### Optional: Postgres + Redis

- **Postgres:** Set `DATABASE_URL` in `apps/api/.env`, then:

  ```bash
  pnpm db:push
  pnpm db:seed   # if you have a seed script
  ```

- **Redis:** Set `REDIS_URL` for signal snapshots, queue persistence, and future BullMQ jobs.

---

## 4. Next steps (in order)

| Step | What to do |
|------|------------|
| **1. Run locally** | Get the app running with `pnpm dev:api` + `pnpm dev:web` and confirm markets load (with or without keys). |
| **2. Get Bags key** | Sign up at https://dev.bags.fm and add `BAGS_API_KEY` so token quotes and launch can use the real API. |
| **3. Get DFlow key** | Email hello@dflow.net for a production key; set `DFLOW_API_KEY` for higher limits and production trading. |
| **4. Add Polymarket keys** | Populate the Polymarket env vars so the second source can poll Gamma + CLOB cleanly. |
| **5. Wire unified buy** | In the app: connect DFlow order/quote and Bags trade quote to the unified buy panel; add wallet sign-and-send. |
| **6. Add Kalshi Builder Code** | When integrating DFlow orders, set referral/fee account so you earn builder fees. |
| **7. Add Bags partner key** | Create partner config in Bags for fee share; use it in launches/trades from Siren. |
| **8. CT layer (optional)** | Add Twitter API or a mock: query mentions for token symbols + event keywords and feed into scoring. |
| **9. Launch Signal** | When a market has high velocity but no surfaced tokens, show “Launch a token” with pre-filled Bags form. |
| **10. Deploy** | Frontend on Vercel, API + Postgres + Redis on Railway (or Fly.io); set env vars; submit to grants / hackathons. |

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
curl http://localhost:4000/api/signals

# 5. Open app
open http://localhost:3000
```

**Keys (set in `apps/api/.env` when you have them):**

- **Bags:** dev.bags.fm → `BAGS_API_KEY`; partner config → `BAGS_PARTNER_CONFIG_KEY`; ref link → `BAGS_REF_URL`
- **DFlow:** Request via form (see above) → `DFLOW_API_KEY`
- **Kalshi:** kalshi.com → API → `KALSHI_API_KEY` + `KALSHI_PRIVATE_KEY` (RSA PEM)
- **Polymarket:** polymarket.com → credentials → `POLYMARKET_API_KEY`, `POLYMARKET_SECRET`, `POLYMARKET_PASSPHRASE`
- **Twitter:** developer.x.com → Basic → Bearer → `TWITTER_BEARER_TOKEN`

**Security:** Never commit `.env` (it’s in `.gitignore`). If any key was ever exposed (e.g. in chat or a screenshot), rotate it in the provider’s dashboard.
