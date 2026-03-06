# Siren Terminal — Feature Manifest

Standard terminal capabilities and roadmap. Brand assets incoming — placeholder paths prepared.

## Current Features

| Feature | Status | Notes |
|---------|--------|-------|
| **DFlow-first swap router** | ✅ | Prediction market tokens via DFlow, Jupiter fallback for all SPL |
| **MEV protection** | ✅ | Jupiter routing includes MEV-resistant paths |
| **Prediction markets** | ✅ | Kalshi via DFlow; markets list, velocity, sort/filter |
| **Token swap (buy/sell)** | ✅ | Unified panel; DFlow or Jupiter |
| **Slippage** | ⚙️ | Default 2% (200 bps); configurable via API |
| **Bags token launch** | ✅ | Create token, social links, fee share |
| **Portfolio** | ✅ | Balances, positions, token holdings, Bags launches |
| **Watchlist** | ✅ | Saved markets/tokens |
| **Responsive layout** | ✅ | Mobile markets sheet, adjustable sidebar |

## Planned / Placeholder

| Feature | Status | Notes |
|---------|--------|-------|
| **Slippage UI** | 📋 | Slider/preset in UnifiedBuyPanel (25, 50, 100, 200, 500 bps) |
| **MEV badge** | 📋 | Display “MEV protected” in swap panel |
| **Limit orders** | 📋 | Conditional / limit for markets (DFlow API dependent) |
| **Price alerts** | 📋 | Token/market alerts; notify on threshold |
| **PWA / offline** | 📋 | Service worker, install prompt |
| **Charts** | 📋 | Real price history (DexScreener/Jupiter) |
| **RPC fallback** | 📋 | Multiple RPC endpoints |
| **Transaction history** | 📋 | Recent swaps, link to explorer |

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
