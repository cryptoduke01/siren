# Siren — API Research & Integration Checklist

## Summary

Siren bridges **Kalshi prediction markets** (via DFlow) with **Bags meme tokens** on Solana. This document consolidates API research for each data source.

---

## 1. Kalshi API (Market Data Source)

**Base URL:** `https://api.elections.kalshi.com/trade-api/v2`  
**Docs:** https://docs.kalshi.com/

### Key Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/markets` | GET | List markets (filter: status=open, series_ticker, event_ticker) |
| `/markets/{ticker}` | GET | Single market with yes/no prices, volume |
| `/events` | GET | Events (containers for markets) |
| `/market/candlesticks/{ticker}` | GET | Historical probability for velocity calc |

### Auth
- API key required for WebSocket
- REST market data: may work without auth for public data (check rate limits)

### Velocity Calculation
- Fetch markets every 60s
- Store last probability in Redis
- `velocity = (current_prob - last_prob) / (elapsed_hours)` → % change per hour
- Rank by `abs(velocity)`

---

## 2. DFlow API (Kalshi Tokenization + Trading)

**Metadata API (dev):** `https://dev-prediction-markets-api.dflow.net`  
**Quote/Trading API (dev):** `https://dev-quote-api.dflow.net`  
**Docs:** https://pond.dflow.net | https://dflow.mintlify.app

### Metadata API — Discovery
| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/events?withNestedMarkets=true&status=active` | Events + nested markets |
| `GET /api/v1/markets` | List markets (volume24h, volume, openInterest sort) |
| `GET /api/v1/events?seriesTickers=KXBTC` | Filter by asset/series |
| `GET /api/v1/tags_by_categories` | Categories → tags (Macro, Crypto, etc.) |
| `GET /api/v1/live_data` | Live bid/ask, probability |
| `GET /api/v1/outcome_mints` | YES/NO token mints per market |

### Trading API — Execution
| Endpoint | Purpose |
|----------|---------|
| `GET /order` | Preferred: quote + transaction in one call |
| `GET /quote` | Legacy: swap quote only |
| `POST /swap` | Execute swap (after quote) |
| `GET /order-status` | Poll async order status |

### Order Params (Kalshi Prediction)
- `inputMint`: USDC (or SOL)
- `outputMint`: YES or NO outcome mint from market
- `amount`: scaled integer
- `userPublicKey`: wallet
- `predictionMarketSlippageBps`: slippage for PM
- `referralAccount` / `feeAccount`: Builder Code for Kalshi fees

### Auth
- Header: `x-api-key`
- Production: contact hello@dflow.net

---

## 3. Bags API (Meme Token Launch + Trade)

**Base URL:** `https://public-api-v2.bags.fm/api/v1/`  
**Docs:** https://docs.bags.fm/

### Key Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /token-launch/trade-quote` | Quote for buy (input: SOL/USDC, output: token mint) |
| `POST /token-launch/create-token-info` | Create metadata + mint |
| `POST /config/create-fee-share-config` | Fee share config |
| `POST /token-launch/create-launch-transaction` | Launch tx |
| `GET /token-launch/pools` or `/fee-share/token/claimable-positions` | Pools / claimable |
| `GET /token-launch/creator/v3?tokenMint=` | Creator info |
| `GET /token-launch/lifetime-fees?tokenMint=` | Fees |
| `POST /send-transaction` | Submit signed tx |

### Token Discovery (Gap)
- **Bags has no keyword/search API** for tokens.
- **Siren uses DexScreener** for token discovery (see section 5).

### SDK: `@bagsfm/bags-sdk`
- `BagsSDK` — init with API key, connection
- `sdk.tokenLaunch.createTokenInfoAndMetadata`, `createLaunchTransaction`
- `sdk.config.createBagsFeeShareConfig`
- Partner config for fee split

---

## 4. DexScreener API (Token Discovery)

**Base URL:** `https://api.dexscreener.com`  
**Docs:** https://docs.dexscreener.com/api/reference  
**API Key:** None required.

### Key Endpoints
| Endpoint | Purpose | Rate limit |
|----------|---------|------------|
| `GET /latest/dex/search?q={query}` | Search pairs by token symbol, name, or address | ~300/min |
| `GET /token-pairs/v1/{chainId}/{tokenAddress}` | Pairs for a token | ~300/min |
| `GET /token-boosts/top/v1` | Top boosted tokens (trending) | 60/min |
| `GET /token-boosts/latest/v1` | Latest boosted tokens | 60/min |

### Siren Usage
- **Category-based surfacing:** Search by tag keywords (trump, jpow, etc.) → filter Solana pairs → map to SurfacedToken
- **Trending:** Use default keywords (trump, jpow, pepe, bonk, wif, popcat) when no category
- **Fallback:** Mock tokens when DexScreener errors or returns empty

### Env
- `DEXSCREENER_BASE_URL` — optional; defaults to `https://api.dexscreener.com`

---

## 5. Jupiter API (Swap Quotes + Execution)

**Base URL (Basic):** `https://api.jup.ag`  
**Base URL (Ultra):** `https://api.jup.ag/ultra`  
**Docs:** https://dev.jup.ag/docs/api-setup | https://dev.jup.ag/docs/api/swap-api/quote  
**API Key:** Required. Get at https://portal.jup.ag/api-keys

| Tier | Rate Limit | Base URL |
|------|------------|----------|
| Basic | 1 RPS (fixed) | `https://api.jup.ag` |
| Ultra | Dynamic (scales with swap volume) | `https://api.jup.ag/ultra` |

### Key Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /swap/v1/quote` | Quote for swap (inputMint, outputMint, amount, slippageBps) |
| `POST /swap/v1/swap` | Build swap transaction from quote |

### Auth
- Header: `x-api-key`

### Siren Usage
- API proxies `GET /api/jupiter/quote?inputMint=&outputMint=&amount=` → Jupiter `/swap/v1/quote` with API key
- Use for Bags/Solana token buys when user clicks Buy in UnifiedBuyPanel

### Env
- `JUPITER_API_KEY` — required for quote/swap proxy

---

## 6. Twitter / X API (CT Signal Layer)

- **Basic tier:** $100/mo — search recent tweets, count mentions
- **Nitter:** Open-source Twitter frontend, scrape as fallback (no official API)
- **Use:** Query `$TOKEN` + event keywords → mention velocity

---

## 7. Tag Library (Starter)

| Kalshi Category | CT Keywords |
|-----------------|-------------|
| Fed / Rates | jpow, rates, fed, fomc, printer, brr, ratecut, ratehike, inflation |
| CPI / Inflation | cpi, inflation, prices, dollar, purchasing power |
| Elections | trump, election, vote, potus, whitehouse, dc |
| Crypto Regulation | sec, gensler, crypto law, regulation, etf |
| BTC Price | bitcoin, btc, sats, satoshi, digital gold, number go up |
| ETH / L2s | ethereum, eth, l2, rollup, based, vitalik |
| AI | ai, agi, openai, sam altman, robot, singularity |
| Recession | recession, gdp, unemployment, layoffs, economy |
| Weather | storm, flood, disaster, climate |

---

## 8. Build Order Checklist

- [x] Day 1: Kalshi/DFlow market fetch, velocity, Redis, WebSocket
- [ ] Day 2: Bags SDK, token search (curated + tag match), tag library seed
- [ ] Day 3: Next.js + Tailwind UI, left (markets) + right (tokens) panels
- [ ] Day 4: DFlow order/quote, unified buy panel, wallet connect
- [ ] Day 5: CT signal (X API or mock), scoring engine
- [ ] Day 6: Launch Signal, Portfolio, Trending tab
- [ ] Day 7: Polish, deploy, Kalshi grant + Bags hackathon

---

## 9. Environment Variables

```env
# Kalshi (optional for REST, required for WS)
KALSHI_API_KEY=
KALSHI_API_SECRET=

# DFlow
DFLOW_API_KEY=

# Bags
BAGS_API_KEY=

# DexScreener (no key)
DEXSCREENER_BASE_URL=https://api.dexscreener.com

# Jupiter (https://portal.jup.ag)
JUPITER_API_KEY=

# Twitter (optional)
TWITTER_BEARER_TOKEN=

# Infra
REDIS_URL=
DATABASE_URL=
NEXT_PUBLIC_WS_URL=
```
