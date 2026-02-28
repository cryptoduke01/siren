# Siren

Event-driven meme token terminal on Solana. Watch Kalshi prediction market probabilities in real time and surface Bags tokens tied to those events. Trade markets and tokens from one UI.

## What Siren Does

Siren connects prediction market data from Kalshi (via DFlow) with meme tokens on Solana (via Bags and DexScreener). You can:

- Browse prediction markets with live probability and velocity
- Surface tokens matched to market keywords (DexScreener search)
- Buy YES or NO on markets in-app (DFlow) or on Kalshi
- Buy tokens via Jupiter swaps
- Launch new meme tokens via Bags
- Filter markets by category (Politics, Crypto, Sports, Business, Entertainment)
- Use on mobile as a feed with bottom sheet market picker

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind, Framer Motion, TanStack Query, Zustand, Solana Wallet Adapter (Phantom, Solflare, Torus)
- Backend: Fastify 5, Prisma, PostgreSQL
- APIs: DFlow (Kalshi markets + trading), Jupiter (token swaps), DexScreener (token search), Bags (token launch)

## Project Structure

```
apps/
  web/     Next.js frontend (port 3000)
  api/     Fastify backend (port 4000)
packages/
  shared/  Shared types and tag library
docs/
  GETTING_STARTED.md   API keys and setup
```

## Quick Start

```bash
pnpm install
pnpm dev:api    # Terminal 1: API on :4000
pnpm dev:web    # Terminal 2: Frontend on :3000
```

Copy `apps/api/.env.example` to `apps/api/.env` and fill in API keys. See docs/GETTING_STARTED.md for details.

## Environment

Backend (`apps/api/.env`):

- `DFLOW_API_KEY` – DFlow (markets + trading). Request at pond.dflow.net.
- `BAGS_API_KEY` – Bags (token launch). Sign up at dev.bags.fm.
- `JUPITER_API_KEY` – Jupiter (token swaps). Get at portal.jup.ag.
- `DATABASE_URL` – PostgreSQL (optional for MVP)
- `DEXSCREENER_BASE_URL` – Optional; defaults to api.dexscreener.com

Frontend (`apps/web/.env.local`):

- `NEXT_PUBLIC_API_URL` – Backend URL (default http://localhost:4000)
- `NEXT_PUBLIC_SOLANA_RPC_URL` – Optional custom RPC (e.g. Helius)

## Hosting

Frontend (Next.js): Vercel. Import repo, set Root Directory to `apps/web`, add `NEXT_PUBLIC_API_URL` to your deployed API URL.

Backend (Fastify): Railway or Render. Set Root Directory to `apps/api`, Build Command `pnpm install && pnpm build`, Start Command `node dist/index.js`. Add Postgres and Redis from the provider dashboard if needed.

Database: Railway Postgres, Supabase, or Neon.

After deploying the API, set `NEXT_PUBLIC_API_URL` in Vercel to the API URL and redeploy the frontend.

## Build

```bash
pnpm build
```

## License

Private.
