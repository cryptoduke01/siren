# Siren DX Report

This report captures the current builder experience integrating sponsor-track infrastructure into Siren as of April 16, 2026.

## Project

Siren is building an execution and risk intelligence layer for prediction markets. The product focus is not generic discovery. It is feasibility, route quality, failure explanation, exposure clarity, and post-trade learning.

## Jupiter

### What we integrated

- Existing Siren swap flow already used Jupiter swap routing.
- This pass added a Jupiter prediction comparison layer through:
  - `GET /api/integrations/jupiter/prediction-map`
  - `apps/api/src/services/jupiterPrediction.ts`
  - `apps/web/src/hooks/useJupiterPredictionMap.ts`
  - `apps/web/src/components/MarketExecutionSurface.tsx`

### What worked well

- Prediction search is strong enough to map related events across venues from a title plus outcome label.
- Reusing one `JUPITER_API_KEY` across swap and prediction surfaces is a good platform story.

### Friction

- Prediction search is easy to use once the endpoint is known, but the product-facing URL structure for venue deep links is not obvious enough from the API response alone.
- Venue-specific URL derivation still feels heuristic in the UI layer, especially for Kalshi.
- Search relevance is decent, but multi-outcome event matching still benefits from Siren-side query cleanup.

### What we want improved

- Provider responses should make canonical venue URLs explicit.
- More examples for multi-outcome prediction event matching would help a lot.
- A first-class “related markets / same thesis across venues” example in docs would directly help products like Siren.

## GoldRush / Covalent

### What we integrated

- Wallet intelligence via:
  - `GET /api/integrations/goldrush/wallet-intelligence`
  - `apps/api/src/services/goldrush.ts`
  - `apps/web/src/hooks/useGoldRushWalletIntelligence.ts`
  - `apps/web/src/app/portfolio/page.tsx`

### What worked well

- Structured balance reads are much faster to ship against than raw RPC parsing.
- GoldRush is useful for turning wallet state into product decisions instead of just dashboards.

### Friction

- The biggest product question is not “what balances exist,” it is “which balances are actually deployable for this workflow.”
- That means Siren still has to derive execution-specific risk flags on top of balance data.

### What we want improved

- More docs or examples around portfolio readiness, concentration scoring, and alerting patterns would help product builders.
- Better examples of Solana-specific operational wallet scoring would make GoldRush more immediately useful for risk products.

## Torque

### What we integrated

- Torque-ready custom event relay through:
  - `apps/api/src/services/torque.ts`
  - `GET /api/integrations/torque/readiness`
  - trade-attempt emission inside `POST /api/trade-attempts/log`

### What worked well

- Siren’s execution log maps naturally onto campaign events like successful closes, failed attempts, and partial fills.
- The mental model fits retention well: leaderboards, rebates, resolve-before-expiry campaigns, and execution-quality incentives.

### Friction

- The best integration path for custom event ingestion needs to be extremely obvious, because teams like Siren want to plug in product events fast without reverse-engineering an ingestion shape.
- There is a difference between “reward volume” and “reward better execution behavior”; the latter should have stronger examples.

### What we want improved

- More end-to-end examples around custom events for trading products.
- Clearer docs on the minimal event envelope for campaign eligibility.

## Summary

The sponsor integrations are a good fit for Siren when used to strengthen the real product:

- Jupiter for cross-venue prediction context
- GoldRush for wallet readiness and risk flags
- Torque for execution-linked growth loops

The biggest product lesson is simple: integrations only feel strong when they directly improve execution and risk clarity. That is the standard Siren is using for every track.
