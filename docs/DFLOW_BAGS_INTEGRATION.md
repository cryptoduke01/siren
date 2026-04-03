# DFlow & Bags — Deeper Integration Ideas

Beyond the current usage (Kalshi markets via DFlow, token launch via Bags), here are ways to integrate DFlow and Bags more deeply into Siren.

---

## DFlow (prediction markets)

**Current:** Markets list from DFlow Metadata API, velocity/sorting, and buy YES/NO via `/api/dflow/order` (quote + transaction).

**Positions (implemented):** `GET /api/dflow/positions?wallet=<pubkey>` loads SPL + Token-2022 balances, calls DFlow `filter_outcome_mints` and `markets/batch`, and returns official outcome rows (`DflowPositionRow` in `@siren/shared`). The Portfolio page merges these with heuristic market-list mapping and shows a **DFlow** badge on verified rows. Requires `SOLANA_RPC_URL` (or falls back to public mainnet) and `DFLOW_METADATA_API_URL` / `DFLOW_API_KEY` as for other DFlow calls.

**Possible extensions:**

1. **Order history / cost basis**
   - Pair DFlow positions with fill history or Siren trade logs for **realized** PnL and average entry (Kalshi/DFlow if exposed).

2. **Limit orders**
   - If DFlow supports limit or conditional orders, add a “Place limit order” flow next to the current market order (e.g. “Buy YES when probability &lt; 50%”).

3. **More markets / filters**
   - Use extra DFlow metadata (category, expiry, liquidity) to add filters, “Ending soon”, or “High liquidity” in the markets list.

4. **Real-time quotes**
   - Poll or subscribe to DFlow quote/orderbook (if available) so the terminal shows live mid/ask without placing an order.

5. **Sell / close position**
   - Use DFlow to sell YES/NO back (outputMint = SOL or the opposite side). Wire “Sell” in the Portfolio prediction positions to call `/api/dflow/order` with the correct mints and amount.

---

## Bags (token launch & ecosystem)

**Current:** Launch token (create-token-info, fee-share config, create-launch-transaction) and optional partner fee config.

**Possible extensions:**

1. **Token analytics**
   - If Bags exposes API for token stats (volume, holders, price), show “Bags-powered” tokens in Trending or a dedicated “Bags” section with volume/price.

2. **Boost / promote**
   - Bags may have a “boost” or “feature” API. Use it to surface launched tokens in the Activity feed or a “Recently launched on Bags” strip.

3. **Creator dashboard**
   - For wallets that have launched tokens, show “Your launches” (metadata + link to Bags/trade) in Portfolio or a dedicated Creator page.

4. **Fee share / claim**
   - If Bags supports querying or claiming fee share, add a “Claim fees” or “Fee earnings” section that pulls balances and allows claim (when API exists).

5. **More launch options**
   - Initial liquidity, bonding curve params, or social links in create-token-info if Bags API supports them. Expose these in the Launch token panel.

---

## Cross-cutting

- **Unified “Trade”:** One entry point that can route to “Trade market” (DFlow) or “Swap token” (Jupiter) based on context.
- **Alerts:** Already have market/token alerts; optionally trigger “DFlow fill” or “Bags launch live” notifications when APIs support webhooks or polling.
- **Portfolio:** Show DFlow positions and Bags-launched tokens in the same Portfolio view with clear labels (e.g. “Kalshi (DFlow)”, “Launched on Bags”).

Implementing any of the above depends on DFlow/Bags API capabilities and product priorities. Check their docs and dashboards for the latest endpoints and limits.
