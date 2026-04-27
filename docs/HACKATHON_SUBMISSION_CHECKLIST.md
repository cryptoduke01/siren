# Hackathon Submission Checklist

This is the working checklist for Siren across Frontier and the current side tracks.

## Common Preflight

- Public GitHub repo is up to date.
- Live product link works.
- DX report is public and readable.
- Demo video exists or is recorded.
- Sponsor tags and required social posts are ready.
- API keys and sponsor integrations are visible in the product or demo.

## Frontier Main Track

### Status

- In progress

### Required

- Public repo link
- Live app or demo video
- Working product narrative
- Clean description of what Siren does now

### Siren next actions

- Confirm the live deploy after the latest push.
- Make sure the landing page and demo show the new execution-and-risk positioning clearly.
- Record one short walkthrough showing browse -> trade context -> trade attempt -> traction/admin proof.

## Jupiter Developer Platform

### Status

- Closest to submission-ready

### Required

- Working project using one or more Jupiter APIs through the Developer Platform
- Public project link
- Public DX report
- Email tied to the Jupiter Developer Platform account at `developers.jup.ag`

### Siren already has

- Jupiter swap routing in the existing Siren flow
- Jupiter prediction context integration
- Updated `DX-REPORT.md`

### Siren next actions

- Redeploy API and web so the live build reflects the current repo.
- Verify the Jupiter-linked product flow works in production.
- Submit on Superteam Earn with:
  - repo link
  - live app or demo video
  - public DX report
  - Developer Platform account email

### Notes

- Be honest that the AI stack was not used deeply enough yet. That is still valid DX feedback.
- Strongest judging lever here is the quality and specificity of the DX report.

## GoldRush / Covalent

### Status

- Integration-ready, submission not complete

### Required

- Project uses one or more GoldRush endpoints
- Public GitHub repo
- Short demo video
- Demo video posted on X tagging `@goldrushdev`

### Siren already has

- Wallet intelligence powered by GoldRush balances and transactions
- GoldRush section in `DX-REPORT.md`

### Siren next actions

- Record a short demo focused on wallet readiness and risk context.
- Post the demo on X and tag `@goldrushdev`.
- Submit the repo plus the X demo link.

### Notes

- This track is much more submission-ready once the required X video exists.

## Torque

### Status

- Technically integrated, not fully submission-ready yet

### Required

- Pass custom events, trigger incentives, or distributors through Torque MCP or API
- Public repo
- Short demo video posted on X tagging `@torqueprotocol`
- Measurable use of incentives: rewards given or participant count
- Brief friction log

### Siren already has

- Trade-attempt telemetry
- Torque event relay path
- Admin traction dashboard
- Torque friction log inside `DX-REPORT.md`
- A Siren-specific Torque setup guide in `docs/TORQUE_MCP_PLAYBOOK.md`

### Siren still needs before a strong submission

- Real live campaign or incentive loop, not just event emission
- Evidence of participants or measurable reward activity
- Demo showing the growth loop clearly

### Siren next actions

1. Register the Torque MCP client with `TORQUE_API_TOKEN`.
2. Select the Siren project in Torque or create it if it does not exist.
3. Create and attach the `siren_trade_execution` custom event schema.
4. Generate a fresh `TORQUE_API_KEY` and set it in `apps/api/.env`.
5. Push one live trade attempt through Siren so the custom event becomes query-ready.
6. Preview a weekly successful-execution leaderboard query.
7. Create one real recurring incentive with `confirmed: false` first, then confirm it.
8. Drive real users through it and capture participant count or rewards distributed.
9. Record the demo only after the incentive has live activity.

### Notes

- This is the one track where “code is merged” is not enough.
- Live measurable incentive usage is the bar.
- Follow `docs/TORQUE_MCP_PLAYBOOK.md` so the repo, MCP flow, and runtime ingestion path stay aligned.

## Deploy Checklist

### Supabase

- Run `apps/api/sql/siren_market_views.sql`
- Run `apps/api/sql/supabase_rls_hardening.sql`

### Render API

- Redeploy backend
- Confirm env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `JUPITER_API_KEY`
  - `GOLDRUSH_API_KEY`
  - `TORQUE_API_KEY`

### Vercel Web

- Redeploy frontend
- Confirm `NEXT_PUBLIC_API_URL` points to the deployed API

## Suggested Order

1. Run Supabase SQL.
2. Redeploy Render.
3. Redeploy Vercel.
4. Verify live app and admin dashboard.
5. Submit Jupiter.
6. Record and post GoldRush demo.
7. Turn on one real Torque campaign and only then submit Torque.
