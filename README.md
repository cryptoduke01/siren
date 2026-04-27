# Siren

Execution and risk intelligence for prediction markets. Live Kalshi and Polymarket signals, feasibility-aware execution (DFlow, Jupiter where routing requires it, Polymarket on Polygon), and portfolio context in one terminal.

| | |
|--|--|
| **Terminal** | [onsiren.xyz](https://onsiren.xyz) |
| **Docs** | [docs.onsiren.xyz](https://docs.onsiren.xyz) |
| **X** | [@sirenmarketsxyz](https://x.com/sirenmarketsxyz) |

## What Siren Does

Siren connects prediction market data from Kalshi (via DFlow) and Polymarket with Solana-native workflows. You can:

- Browse prediction markets with live probability and velocity
- Buy YES or NO in-app (DFlow for Kalshi routable markets, Polymarket CLOB when connected on Polygon)
- Close Kalshi outcome positions from your portfolio (DFlow routing)
- Filter markets by category (Politics, Crypto, Sports, Business, Entertainment)
- Use on mobile as a feed with bottom sheet market picker

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind, Framer Motion, TanStack Query, Zustand, Solana Wallet Adapter (Phantom, Solflare, Torus)
- Backend: Fastify 5, Prisma, PostgreSQL
- APIs: DFlow (Kalshi markets + trading), Jupiter (aggregator when the swap route needs it), Polymarket CLOB

## Project Structure

```
apps/
  web/     Next.js frontend (port 3000)
  api/     Fastify backend (port 4000)
  docs/    Next.js docs site → docs.onsiren.xyz (port 3001 locally if run alone)
packages/
  shared/  Shared types and tag library
docs/
  GETTING_STARTED.md   API keys and setup
  HACKATHON_SUBMISSION_CHECKLIST.md  sponsor-track and deploy checklist
```

## Quick Start

```bash
pnpm install
pnpm dev:api    # Terminal 1: API on :4000
pnpm dev:web    # Terminal 2: Frontend on :3000
# Optional: pnpm dev:docs   # Docs on :3001
```

Copy `apps/api/.env.example` to `apps/api/.env` and fill in API keys. See docs/GETTING_STARTED.md for details.

## Environment

Backend (`apps/api/.env`):

- `DFLOW_API_KEY` – DFlow (markets + trading). Request at pond.dflow.net.
- `JUPITER_API_KEY` – Jupiter Developer Platform key for swap and prediction APIs. Get it at developers.jup.ag.
- `GOLDRUSH_API_KEY` – GoldRush / Covalent (wallet intelligence on Solana balances).
- `TORQUE_API_KEY` – Torque ingestion key used by the API server to send Siren execution events to `https://ingest.torque.so/events`.
- `TORQUE_API_TOKEN` – Torque MCP auth token for builder tooling such as Codex or Cursor. This is not used by the runtime API server.
- `DATABASE_URL` – PostgreSQL (optional for MVP)

Frontend (`apps/web/.env.local`):

- `NEXT_PUBLIC_API_URL` – Backend URL (default http://localhost:4000)
- `NEXT_PUBLIC_SOLANA_RPC_URL` – Optional custom RPC (e.g. Helius)

## Hosting

**Web** (Next.js): Vercel. Root Directory `apps/web`, set `NEXT_PUBLIC_API_URL` to your deployed API.

**Docs** (Next.js): Separate Vercel project, Root Directory `apps/docs`, domain `docs.onsiren.xyz`. `metadataBase` in `apps/docs/src/app/layout.tsx` should match the live URL.

Backend (Fastify): Render, Fly.io, or Railway. Set Root Directory to `apps/api`, Build Command `pnpm install && pnpm build`, Start Command `node dist/index.js`. Add env vars from `.env.example`. Render has a free tier. Fly.io is good for global deploys. Railway is another option.

Database: Supabase (free tier), Neon, or Railway Postgres.

After deploying the API, set `NEXT_PUBLIC_API_URL` in Vercel to the API URL and redeploy the frontend.

## Torque

Siren now emits one canonical custom event for execution behavior: `siren_trade_execution`. That keeps the schema compact enough for Torque's query builder while still supporting:

- weekly successful-execution leaderboards
- first clean close campaigns
- partial-fill rebates

For the exact Codex MCP command, custom-event schema, and first live campaign path, use `docs/TORQUE_MCP_PLAYBOOK.md`.

## Build

```bash
pnpm build
```

## License

Private.
