# Siren

Execution and risk intelligence for prediction markets. Live Kalshi and Polymarket signals, feasibility-aware execution (DFlow, Jupiter, Polymarket), and portfolio context in one terminal on Solana.

## What Siren Does

Siren connects prediction market data from Kalshi (via DFlow) and Polymarket with Solana execution and token surfacing (DexScreener, Jupiter). You can:

- Browse prediction markets with live probability and velocity
- Surface tokens matched to market keywords (DexScreener search)
- Buy YES or NO on markets in-app (DFlow / Polymarket) or on Kalshi where linked
- Swap tokens via Jupiter
- Filter markets by category (Politics, Crypto, Sports, Business, Entertainment)
- Use on mobile as a feed with bottom sheet market picker

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind, Framer Motion, TanStack Query, Zustand, Solana Wallet Adapter (Phantom, Solflare, Torus)
- Backend: Fastify 5, Prisma, PostgreSQL
- APIs: DFlow (Kalshi markets + trading), Jupiter (token swaps), DexScreener (token search)

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
- `JUPITER_API_KEY` – Jupiter (token swaps). Get at portal.jup.ag.
- `DATABASE_URL` – PostgreSQL (optional for MVP)
- `DEXSCREENER_BASE_URL` – Optional; defaults to api.dexscreener.com

Frontend (`apps/web/.env.local`):

- `NEXT_PUBLIC_API_URL` – Backend URL (default http://localhost:4000)
- `NEXT_PUBLIC_SOLANA_RPC_URL` – Optional custom RPC (e.g. Helius)

## Hosting

Frontend (Next.js): Vercel. Import repo, set Root Directory to `apps/web`, add `NEXT_PUBLIC_API_URL` to your deployed API URL.

Backend (Fastify): Render, Fly.io, or Railway. Set Root Directory to `apps/api`, Build Command `pnpm install && pnpm build`, Start Command `node dist/index.js`. Add env vars from `.env.example`. Render has a free tier. Fly.io is good for global deploys. Railway is another option.

Database: Supabase (free tier), Neon, or Railway Postgres.

After deploying the API, set `NEXT_PUBLIC_API_URL` in Vercel to the API URL and redeploy the frontend.

## Build

```bash
pnpm build
```

## License

Private.
