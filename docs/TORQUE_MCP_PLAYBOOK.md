# Torque MCP Playbook

This is the Siren-specific path to a real Torque bounty submission.

## Goal

Get from live Siren trade telemetry to one measurable recurring incentive with:

- live custom events
- a real participant count
- visible rewards or pending allocations
- a short demo we can post tagging `@torqueprotocol`
- a friction log grounded in what actually happened

## Credential Split

Torque uses two different secrets in Siren:

- `TORQUE_API_TOKEN`
  - Builder auth for Codex / Cursor / Claude MCP clients
  - Used to create projects, custom events, API keys, and incentives
- `TORQUE_API_KEY`
  - Runtime ingestion key
  - Used by `apps/api` when Siren POSTs events to `https://ingest.torque.so/events`

Do not treat them as interchangeable.

## Codex Setup

Use the Codex-native command, not the Claude one:

```bash
codex mcp add torque --env TORQUE_API_TOKEN=your-token -- npx @torque-labs/mcp@latest
```

Verify:

```bash
codex mcp get torque
```

## Siren Custom Event

Siren now emits one canonical event:

- `siren_trade_execution`

We keep the schema intentionally compact so it stays easy to query:

| Field | Type | Why it exists |
|---|---|---|
| `route` | `string` | Venue + mode, for example `dflow:buy-market` |
| `market` | `string` | Market label or ticker |
| `side` | `string` | `buy`, `sell`, `yes`, `no`, or route-specific side |
| `status` | `string` | `attempted`, `success`, `failed` |
| `reason` | `string` | `filled`, `partial_fill`, `no_route`, `verification`, etc. |
| `amount` | `number` | Notional amount attached to the action |
| `filledFraction` | `number` | Fraction filled on partial executions |
| `isPartialFill` | `boolean` | Makes partial-fill filters trivial |

This event is emitted from `apps/api/src/services/torque.ts`.

## Recommended First Campaign

Start with a weekly successful-execution leaderboard.

Why this one first:

- it is easy to explain in a demo
- it matches the bounty's "live measurable activity" requirement
- it works with real Siren trading behavior, not vanity actions
- it can graduate later into a richer execution-quality score

## MCP Flow

Use the real Torque MCP flow in this order:

1. `check_auth_status`
2. `authenticate`
3. `list_projects`
4. `set_active_project`
5. `create_custom_event`
6. `attach_custom_event`
7. `create_api_key`
8. `generate_incentive_query`
9. `preview_incentive_query`
10. `create_recurring_incentive`

## Exact Siren Event Schema

Create this custom event first.

```json
{
  "eventName": "siren_trade_execution",
  "name": "Siren Trade Execution",
  "fields": [
    { "fieldName": "route", "type": "string" },
    { "fieldName": "market", "type": "string" },
    { "fieldName": "side", "type": "string" },
    { "fieldName": "status", "type": "string" },
    { "fieldName": "reason", "type": "string" },
    { "fieldName": "amount", "type": "number" },
    { "fieldName": "filledFraction", "type": "number" },
    { "fieldName": "isPartialFill", "type": "boolean" }
  ]
}
```

Attach it to the active Siren project immediately after creation.

## Ingestion Step

After the schema is attached:

1. create a Torque ingestion key with `create_api_key`
2. put that key into `apps/api/.env` as `TORQUE_API_KEY`
3. run Siren and trigger at least one live trade attempt

Important:

- Torque custom events are not query-ready until at least one event has been ingested
- if you skip this step, query generation for the custom event will stall

## Query Blueprint

For the first leaderboard, use the custom event as the source and start simple.

Suggested query shape:

- `source: "custom_event"`
- `valueExpression: "COUNT(*)"`
- `filters: ["status = 'success'"]`

This gives a clean "successful executions per wallet" leaderboard.

After that works, graduate to a stricter quality score or a partial-fill rebate.

## Incentive Blueprint

Recommended first incentive:

- `name`: `Weekly Clean Execution Leaderboard`
- `type`: `leaderboard`
- `interval`: `WEEKLY`
- `customFormula`: `RANK == 1 ? 300 : RANK == 2 ? 200 : RANK == 3 ? 100 : RANK <= 10 ? 50 : 0`

Always preview it first with `confirmed: false`.

Torque adds a 5% protocol fee on top of the reward pool, so a `1000` pool costs `1050`.

## Good Second Campaign

Once the leaderboard is live, add a partial-fill rebate:

- filter: `isPartialFill = true`
- value expression: `SUM(amount)`
- type: `rebate`
- rebate percentage: `5`

That turns a real Siren pain point into a measurable retention loop.

## Bounty Checklist

Before submission, make sure all of these are true:

- Siren has emitted live `siren_trade_execution` events
- the custom event is attached to the correct Torque project
- at least one recurring incentive exists in Torque
- the incentive has real participants or visible allocations
- the public repo includes this integration path
- the demo video shows the event -> incentive -> participant loop
- the X post tags `@torqueprotocol`
- the friction log is reflected in `DX-REPORT.md`

## Current Repo Touchpoints

- Runtime event relay: `apps/api/src/services/torque.ts`
- Readiness endpoint: `GET /api/integrations/torque/readiness`
- Trade telemetry trigger: `POST /api/telemetry/trade-attempt`
- Docs and submission prep:
  - `README.md`
  - `docs/GETTING_STARTED.md`
  - `docs/HACKATHON_SUBMISSION_CHECKLIST.md`
  - `DX-REPORT.md`

## Friction Log We Should Submit

- Installing the MCP is fast, but the credential split between MCP auth and ingestion auth needs to be clearer.
- Query-ready custom events depend on one live ingestion after schema attachment, which is easy to miss.
- Trading products need more behavior-driven examples, not just pure volume leaderboards.
- Compact event schemas matter more than expected when the product naturally wants to emit lots of strings.
