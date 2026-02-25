# Siren

**Event-Driven Meme Token Terminal** — Watch Kalshi market probabilities in real time and surface Bags tokens thematically tied to those events. Trade both from one UI.

## Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind, Framer Motion, TanStack Query, Zustand, Solana Wallet Adapter
- **Backend:** Fastify 5, Redis, Prisma 6 + PostgreSQL, BullMQ, WebSockets
- **APIs:** Kalshi, DFlow (metadata + trading), Bags SDK

## Design

- **Background:** `#08080F` (near-black, blue undertone)
- **Primary:** `#E8FF47` (electric lime)
- **Secondary:** `#7B61FF` (violet)
- **Bags:** `#00FF85` | **Kalshi:** `#5CCC7A`
- **Fonts:** Geist / Space Grotesk (headings), JetBrains Mono (data), Inter (body)

## Quick Start

```bash
pnpm install
pnpm dev:api &   # Backend on :4000
pnpm dev:web     # Frontend on :3000
```

**API keys, testing, and next steps:** see **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** for how to get DFlow, Bags, Kalshi, and Twitter keys, run without keys, and the full build checklist.

### Upgrade all packages to latest

From the repo root:

```bash
pnpm upgrade
```

This runs `pnpm -r update --latest` to bump every workspace to the latest versions.

`
### Env
Copy `apps/api/.env.example` → `apps/api/.env` and fill:
- `DATABASE_URL` — Postgres
- `REDIS_URL` — Redis (optional for MVP)
- `DFLOW_API_KEY` — DFlow (optional for dev)
- `BAGS_API_KEY` — Bags

## Structure

```
apps/
  web/          Next.js frontend
  api/          Fastify backend + WebSocket
packages/
  shared/       Types, tag library
docs/
  API_RESEARCH.md   API notes
```

## Build Order

1. ✅ Kalshi/DFlow market fetch, velocity, WebSocket
2. Bags SDK, token search, tag library seed
3. ✅ Frontend: market feed + token surface
4. DFlow order/quote, unified buy panel, wallet connect
5. CT signal layer (X API or mock)
6. Launch Signal, Portfolio, Trending tab
7. Polish, deploy
