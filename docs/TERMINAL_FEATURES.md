# Siren Terminal — Feature Manifest

Standard terminal capabilities and roadmap. Brand assets incoming — placeholder paths prepared.

## Current Features

| Feature | Status | Notes |
|---------|--------|-------|
| **DFlow-first swap router** | OK | Prediction market tokens via DFlow, Jupiter fallback for all SPL |
| **MEV protection** | OK | Jupiter routing includes MEV-resistant paths |
| **Prediction markets** | OK | Kalshi via DFlow plus Polymarket via Gamma/CLOB; shared signal feed, source badges, filter buttons |
| **Token swap (buy/sell)** | OK | Unified panel; DFlow or Jupiter |
| **Slippage** | Config | Default 2% (200 bps); configurable via API |
| **Bags token launch** | OK | Create token, social links, fee share |
| **Portfolio** | OK | Balances, positions, token holdings, Bags launches |
| **Watchlist** | OK | Saved markets/tokens |
| **Responsive layout** | OK | Mobile markets sheet, adjustable sidebar |
| **Privy social onboarding** | OK | Google / GitHub / X only; embedded Solana + EVM wallets on login |

## Planned / Placeholder

| Feature | Status | Notes |
|---------|--------|-------|
| **Slippage UI** | WIP | Slider/preset in UnifiedBuyPanel (25, 50, 100, 200, 500 bps) |
| **MEV badge** | WIP | Display “MEV protected” in swap panel |
| **Limit orders** | WIP | Conditional / limit for markets (DFlow API dependent) |
| **Price alerts** | WIP | Token/market alerts; notify on threshold |
| **PWA / offline** | WIP | Service worker, install prompt |
| **Charts** | WIP | Real price history (DexScreener/Jupiter) |
| **RPC fallback** | WIP | Multiple RPC endpoints |
| **Transaction history** | WIP | Recent swaps, link to explorer |

## Brand Assets (Placeholders)

Replace placeholders when assets arrive:

- `apps/web/public/brand/logo.svg` — Main logo
- `apps/web/public/brand/logo-dark.svg` — Dark mode logo
- `apps/web/public/brand/favicon.ico` — Favicon
- `apps/web/public/brand/og-image.png` — Open Graph (1200×630)
- `apps/web/public/brand/apple-touch-icon.png` — 180×180
- `apps/web/public/icon.svg` — Current fallback (replace with brand)

Update references in:
- `app/layout.tsx` (metadata, icons)
- `manifest.json` (icons)
- TopBar / Onboarding (logo)
- Waitlist page (logo)
