# Bags Fee Claiming

Siren lets users claim Bags fee share directly from the Portfolio. Fees accrue when traders swap tokens you launched (or tokens where you have fee rights).

## Prerequisites

- **BAGS_API_KEY** in `apps/api/.env` (or Render)
- User wallet connected
- User has claimable positions (launched tokens or fee share config)

## How It Works

1. **Claimable positions** — `GET /api/bags/claimable-positions?wallet=<pubkey>`
   - Calls Bags `GET /token-launch/claimable-positions`
   - Returns positions with `totalClaimableLamportsUserShare` per token

2. **Claim transactions** — `POST /api/bags/claim-txs` with `{ feeClaimer, tokenMint }`
   - Calls Bags `POST /token-launch/claim-txs/v3`
   - Returns array of `{ tx: base58, blockhash }` transactions
   - User signs and sends each transaction via their wallet

3. **Portfolio UI** — Fee earnings section shows claimable amounts and a Claim button per token.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bags/claimable-positions?wallet=` | GET | List claimable fee positions for a wallet |
| `/api/bags/claim-txs` | POST | Get claim transactions for `{ feeClaimer, tokenMint }` |

## Position Types

Bags supports multiple fee sources:

- **Virtual pool fees** — Pre-graduation (before token migrates to DAMM v2)
- **DAMM v2 pool fees** — Post-graduation trading
- **Custom fee vault** — Fee share v1/v2 configs

The v3 claim endpoint handles all cases; no extra params needed beyond `feeClaimer` and `tokenMint`.

## References

- [Bags Claim Fees Guide](https://docs.bags.fm/how-to-guides/claim-fees)
- [Get Claimable Positions](https://docs.bags.fm/api-reference/get-claimable-positions)
- [Get Claim Transactions v3](https://docs.bags.fm/api-reference/get-claim-transactions-v3)
