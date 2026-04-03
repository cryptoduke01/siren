# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Siren is a crypto/fintech terminal (pnpm monorepo) with three apps and one shared package:
- **API** (`apps/api`): Fastify 5 backend on port 4000
- **Web** (`apps/web`): Next.js 15 frontend on port 3000
- **Docs** (`apps/docs`): Optional docs site on port 3001
- **Shared** (`packages/shared`): Shared TypeScript types

See `README.md` and `docs/GETTING_STARTED.md` for full setup and API key details.

### Running services

```bash
pnpm dev:api    # API on :4000
pnpm dev:web    # Web on :3000
```

Both can run without any API keys or databases. The API falls back to in-memory state when Redis is unavailable and returns mock/rate-limited data when DFlow/Bags keys are missing.

### Important caveats

- **Shared package must be built before API or Web**: Run `pnpm --filter @siren/shared build` (or `pnpm install` handles it). The API and Web apps import from `@siren/shared` which reads from `packages/shared/dist/`.
- **Prisma client must be generated**: Run `pnpm db:generate` after install. The Prisma schema lives at `apps/api/prisma/schema.prisma`.
- **Redis connection errors are expected**: The API logs `[redis] connection error` and `using in-memory fallback` when no Redis is running. This is normal for local development.
- **Web build (`pnpm build:web`) fails**: Pre-existing ESLint errors (`react-hooks/rules-of-hooks` in `LaunchpadBadge.tsx` and `StarButton.tsx`) cause `next build` to fail. Development mode (`pnpm dev:web`) works fine.
- **API lint (`pnpm --filter api lint`) fails**: No `.eslintrc` config exists for the API app. The lint script is defined but has no config to back it.
- **Web lint has pre-existing warnings**: `pnpm --filter web lint` runs but shows many warnings (img elements, hook deps). The `.eslintrc.json` with `next/core-web-vitals` is needed for it to run at all.
- **Environment files**: Copy `.env.example` to `.env` in `apps/api/` and `.env.example` to `.env.local` in `apps/web/`. Defaults point the frontend to the local API at `localhost:4000`.
- **Access gate**: The web app has an access gate on the main terminal page. The `/trending` page is accessible without login. To bypass the gate, set `SIREN_GATE_ENABLED=false` in `apps/web/.env.local`.

### Lint / Test / Build

```bash
pnpm lint              # Runs lint for all packages (API lint will fail, see above)
pnpm --filter web lint # Web lint only (warnings expected)
pnpm build:api         # TypeScript build for API (works)
pnpm build:web         # Next.js production build (fails due to pre-existing lint errors)
pnpm build             # Build all packages
```

No automated test suite exists in this codebase.
