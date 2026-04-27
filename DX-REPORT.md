# Siren DX Report

This report captures the current builder experience integrating sponsor-track infrastructure into Siren as of April 25, 2026.

## Project

Siren is building an execution and risk intelligence layer for prediction markets. The product focus is not generic discovery. It is feasibility, route quality, failure explanation, exposure clarity, and post-trade learning.

## Jupiter

### What we integrated

- Existing Siren swap flow already used Jupiter swap routing.
- This pass added a Jupiter prediction execution context layer through:
  - `GET /api/integrations/jupiter/prediction-map`
  - `apps/api/src/services/jupiterPrediction.ts`
  - `apps/web/src/hooks/useJupiterPredictionMap.ts`
  - `apps/web/src/components/MarketExecutionSurface.tsx`
- Siren now uses these Prediction endpoints in one flow:
  - `GET /prediction/v1/events/search`
  - `GET /prediction/v1/events/{eventId}`
  - `GET /prediction/v1/orderbook/{marketId}`
  - `GET /prediction/v1/trading-status`

### Onboarding

- Time from landing on `developers.jup.ag` to first successful API call was reasonable once the key existed, roughly 15 to 30 minutes for the first useful response.
- Time from first call to product-grade output was longer because search alone was not enough. In practice we had to stitch search -> event detail -> orderbook -> trading status before Siren could make a real routing or execution-context decision.
- The strongest part of the new Developer Platform story is the single-key model. The weakest part is that product teams still need to discover the best multi-endpoint path themselves.

### What worked well

- The Prediction API is flexible enough to turn one Siren market thesis into a cross-venue read.
- `events/search` is a clean starting point.
- `events/{eventId}` is the endpoint that makes the integration actually useful because it exposes the event’s child markets.
- `orderbook/{marketId}` is what upgrades the integration from “directory lookup” to “execution intelligence”.
- Reusing one `JUPITER_API_KEY` across swap and prediction surfaces is a strong platform story.

### Friction

- Search results alone were not enough. In practice we had to chain search -> event details -> orderbook before the data became product-grade.
- Volume units and pricing semantics require care. Event-level values and market-level values do not feel equally obvious at first glance, especially when you are trying to render user-facing numbers fast.
- Canonical venue URLs are still not explicit enough from the raw response shape, so product teams end up deriving deep links heuristically.
- For multi-outcome theses, the hardest part is not fetching data, it is choosing the best child market match reliably.

### AI stack feedback

- Docs were enough to get the integration working, but the strongest path came from combining multiple pages rather than following one obvious “build a product like this” guide.
- We relied more on the docs surface than the broader AI stack. That is useful signal by itself: the path from landing on the platform to “here is the right context file or CLI flow for this use case” is still not obvious enough.
- The main gap is not raw reference coverage. It is guided integration flow for real product builders who need to combine Swap, Prediction, and platform tooling without guessing.
- The biggest lift would be a first-class example that shows:
  1. search for an event,
  2. fetch full event details,
  3. select the best child market,
  4. inspect orderbook depth,
  5. drive a product decision from the result.

### What we want improved

- Make canonical venue URLs explicit in the response.
- Add a richer “same thesis across venues” example for products doing comparison and routing.
- Add clearer guidance around pricing units and which fields are safe to present directly to users.
- Make the AI stack entry points much more explicit on the landing path: when to use Agent Skills, when to use CLI, when to use docs, and what “best practice” looks like for each.
- If we were rebuilding `developers.jup.ag`, we would push developers into a first successful multi-endpoint workflow immediately instead of starting from static endpoint reference pages.

## GoldRush / Covalent

### What we integrated

- Wallet intelligence via:
  - `GET /api/integrations/goldrush/wallet-intelligence`
  - `apps/api/src/services/goldrush.ts`
  - `apps/web/src/hooks/useGoldRushWalletIntelligence.ts`
  - `apps/web/src/app/portfolio/page.tsx`
- Siren currently uses:
  - `GET /v1/solana-mainnet/address/{wallet}/balances_v2/`
  - `GET /v1/solana-mainnet/address/{wallet}/transactions_v3/`

### What worked well

- GoldRush makes “wallet intelligence” much faster to ship than raw RPC.
- Balances plus recent transaction history are enough to build a real execution-readiness layer:
  - deployable stablecoin reserve
  - native SOL runway
  - concentration risk
  - recent inbound/outbound flow
  - last active timestamp

### Friction

- The biggest product question is not “what balances exist,” it is “which balances are actually deployable for this workflow right now.”
- Siren still has to derive execution-specific risk flags on top of GoldRush’s structured outputs.
- For trading/risk products, more Solana-native examples around recent flow interpretation would help a lot.

### What we want improved

- More example playbooks for wallet scoring on Solana.
- Better examples showing how to turn balances + transactions into alerts, not just dashboards.
- Stronger docs for “portfolio readiness” and “operational wallet health” use cases.

## Torque

### What we integrated

- Torque-ready custom event relay through:
  - `apps/api/src/services/torque.ts`
  - `GET /api/integrations/torque/readiness`
  - trade-attempt emission inside `POST /api/telemetry/trade-attempt`
  - market-view tracking via `POST /api/telemetry/market-view`
  - traction analytics via `GET /api/admin/traction`
- Siren’s event model now centers on one canonical custom event:
  - `siren_trade_execution`
- The compact queryable fields are:
  - `route`
  - `market`
  - `side`
  - `status`
  - `reason`
  - `amount`
  - `filledFraction`
  - `isPartialFill`

### What worked well

- Siren’s execution log maps naturally onto campaign events like successful closes, failed attempts, and partial fills.
- One canonical event is much easier to reason about than several fragmented event names when you get to query generation and incentive design.
- The mental model fits retention well: leaderboards, rebates, and execution-quality incentives are a much better fit than generic “trade more” loops.

### Friction log

- The fastest route for custom event ingestion needs to be extremely obvious. Trading products want to wire product events fast, not reverse-engineer envelope shape.
- Docs are good for installing the MCP quickly, but product teams also need a concrete “here is the minimum event contract to unlock campaigns” example.
- The auth token path was not as self-explanatory as it should be during direct API debugging. An ambiguous “token was not provided” response slows down troubleshooting when a builder is clearly sending a Bearer token.
- Torque’s typed event mapping rewards compact schemas. That is workable, but the limit matters a lot for trading products that instinctively want to send too many string fields.
- “Reward volume” is easier to imagine than “reward better execution behavior”. The latter is where Siren lives, and it needs stronger examples.

### What we want improved

- More end-to-end examples around custom events for trading products.
- Clearer docs on the minimal event envelope for campaign eligibility.
- More explicit guidance on token-vs-ingest credentials so builders do not conflate `TORQUE_API_TOKEN` and `TORQUE_API_KEY`.
- More examples for behavior-based incentives rather than only volume-driven incentives.

## AI Stack Used

- Jupiter docs and endpoint reference
- GoldRush docs
- Torque MCP quickstart docs
- Live endpoint testing from the terminal during implementation

What we used heavily:

- Docs and direct endpoint testing

What we did not use deeply enough yet:

- Jupiter Agent Skills
- Jupiter CLI
- Jupiter Docs MCP
- `llms.txt`

That is not a dodge. It is part of the DX signal. The “use the AI stack during build” path still needs to be surfaced more aggressively if it is meant to be the default builder workflow.

What helped:

- Jupiter’s docs around event discovery and orderbook inspection
- GoldRush’s endpoint structure for balances and transactions
- Torque’s MCP quickstart for setup expectations

What did not help enough:

- Cross-venue product examples for Jupiter
- Behavior-driven reward examples for Torque
- Solana-specific wallet readiness playbooks for GoldRush
- A clearer “start here if you are building with an agent” path on Jupiter

## Summary

The sponsor integrations are a good fit for Siren when used to strengthen the real product:

- Jupiter for cross-venue prediction context and depth reads
- GoldRush for wallet readiness, recent flow, and risk flags
- Torque for execution-linked growth loops

The biggest product lesson is simple: integrations only matter when they improve execution and risk clarity. That is the standard Siren is using for every track.
