# Siren Security Audit

Date: April 21, 2026
Scope: frontend, backend, authentication, authorization, database write paths, infrastructure assumptions, third-party integrations
Auditor mode: adversarial review with remediation follow-up

## 1. Vulnerability Summary

- Critical: 1
- High: 4
- Medium: 1
- Low: 1

## 2. Threat Model

### Attacker profiles

- Anonymous internet user hitting public API routes directly
- Authenticated user attempting horizontal or vertical privilege escalation
- Wallet holder spoofing another wallet or replaying client-shaped requests
- API consumer burning sponsor quotas or poisoning telemetry
- Insider or compromised operator browser abusing weak admin gating

### Entry points

- Public REST API routes under `/api/*`
- Admin routes under `/api/admin/*`
- Wallet-scoped read and write endpoints
- Telemetry ingestion routes used by trade and leaderboard flows
- Third-party proxy routes backed by DFlow, GoldRush, Helius, and Jupiter

### Sensitive assets

- Waitlist and audience email data
- Access codes and email dispatch operations
- User profile identity data
- Wallet-linked trading telemetry
- Leaderboard integrity
- Sponsor API quotas and relay credits

## 3. Detailed Findings

### 3.1 Unauthenticated admin control plane exposed privileged data and actions

- Severity: Critical
- Affected components:
  - `apps/api/src/routes.ts`
  - `apps/web/src/app/admin/page.tsx`
- Description:
  - The admin API surface was publicly reachable without server-side authentication.
  - The frontend relied on a browser passcode gate, which is not an authorization boundary.
  - An attacker could list waitlist entries, audience rows, user stats, volume data, generate access codes, resend emails, bulk-send campaigns, and delete waitlist rows.
- Exploitation scenario:
  1. Anonymous attacker calls `/api/admin/waitlist` or `/api/admin/audience`.
  2. Attacker harvests emails, wallets, and metadata.
  3. Attacker calls destructive or bulk-send admin routes.
- Impact:
  - Full admin-plane compromise, PII exposure, email abuse, onboarding sabotage.
- Recommended fix:
  - Enforce server-side admin authentication on every `/api/admin/*` route.
  - Do not rely on client-only passcode checks.

### 3.2 Wallet-scoped profile mutation endpoints allowed horizontal takeover

- Severity: High
- Affected components:
  - `apps/api/src/routes.ts`
  - `apps/web/src/app/onboarding/page.tsx`
  - `apps/web/src/app/portfolio/page.tsx`
  - `apps/web/src/app/settings/page.tsx`
- Description:
  - Username and avatar updates trusted wallet strings from the request body without proving wallet ownership.
- Exploitation scenario:
  1. Attacker picks another user’s public wallet.
  2. Attacker posts a new username or avatar for that wallet.
  3. Public Siren identity surfaces reflect attacker-controlled content.
- Impact:
  - Impersonation, brand abuse, social engineering.
- Recommended fix:
  - Require signed wallet authorization on wallet-scoped writes.

### 3.3 User tracking accepted forged auth and wallet metadata

- Severity: High
- Affected components:
  - `apps/api/src/routes.ts`
  - `apps/web/src/contexts/AuthContext.tsx`
  - `apps/web/src/components/WalletButton.tsx`
- Description:
  - The user tracking route accepted arbitrary `wallet`, `authUserId`, `email`, and `name` fields from the client without verifying ownership.
- Exploitation scenario:
  1. Attacker submits another wallet or auth user id.
  2. Attacker poisons user metadata and downstream audience state.
- Impact:
  - Corrupted user records, poisoned audience lists, misattribution.
- Recommended fix:
  - Require signed wallet auth for wallet tracking and verified bearer auth for session-linked tracking.

### 3.4 Anonymous telemetry ingestion allowed spoofed trade history and campaign triggers

- Severity: High
- Affected components:
  - `apps/api/src/routes.ts`
  - `apps/api/src/services/leaderboard.ts`
  - `apps/web/src/components/UnifiedBuyPanel.tsx`
  - `apps/web/src/app/portfolio/page.tsx`
- Description:
  - Public telemetry routes accepted forged trade attempts, errors, volume logs, and trade logs.
  - Leaderboard and Torque-facing event logic depend on these rows.
- Exploitation scenario:
  1. Attacker posts fake trade successes or failures for a wallet.
  2. Siren analytics, leaderboard results, and campaign triggers consume that forged data.
- Impact:
  - Integrity failure of execution metrics and growth logic.
- Recommended fix:
  - Require signed wallet auth for Solana telemetry writes and avoid unsigned server acceptance.

### 3.5 Public wallet intelligence endpoints leaked private trading context

- Severity: High
- Affected components:
  - `apps/api/src/routes.ts`
  - `apps/api/src/services/dflowPositions.ts`
  - `apps/web/src/hooks/useGoldRushWalletIntelligence.ts`
  - `apps/web/src/app/portfolio/page.tsx`
- Description:
  - Public reads exposed wallet positions, execution attempt history, GoldRush wallet intelligence, proof state, and transactions for any wallet string.
- Exploitation scenario:
  1. Attacker scrapes a trader wallet.
  2. Attacker queries Siren APIs to reconstruct strategy, balances, recent failures, and readiness state.
- Impact:
  - Strategy leakage, privacy loss, profiling.
- Recommended fix:
  - Require signed wallet auth for sensitive wallet reads.

### 3.6 Public API-key-backed proxy routes were open to quota exhaustion

- Severity: Medium
- Affected components:
  - `apps/api/src/index.ts`
  - `apps/api/src/routes.ts`
- Description:
  - Anonymous callers could repeatedly hit sponsor-backed or RPC-heavy routes and burn quotas.
- Exploitation scenario:
  1. Attacker scripts requests against public route proxies.
  2. Upstream partners rate-limit or exhaust credits.
  3. Real users get degraded routing or positions responses.
- Impact:
  - Availability loss and sponsor credit burn.
- Recommended fix:
  - Add authentication for expensive reads, caching, and rate limiting.

### 3.7 Private-key export UX had insufficient danger framing

- Severity: Low
- Affected components:
  - `apps/web/src/components/WalletButton.tsx`
- Description:
  - The wallet menu exposed private-key export with minimal warning context.
- Exploitation scenario:
  1. Compromised browser or social engineering convinces user to export the key.
  2. User copies and leaks the private key.
- Impact:
  - Full wallet compromise if abused.
- Recommended fix:
  - Add stronger warning language and step-up confirmation.

## 4. Attack Chains

### Chain A: Admin compromise from the public internet

1. Anonymous attacker enumerates `/api/admin/*` routes.
2. Attacker harvests audience and waitlist data.
3. Attacker sends malicious campaigns or deletes records.

### Chain B: Identity poisoning plus profile takeover

1. Attacker poisons user metadata through unauthenticated tracking.
2. Attacker changes username or avatar for that wallet.
3. Public surfaces show attacker-crafted identity tied to the victim wallet.

### Chain C: Telemetry forgery into leaderboard and campaign abuse

1. Attacker submits forged trade attempts, errors, and trade logs.
2. Leaderboard and execution analytics ingest the forged rows.
3. Torque campaign flows or growth incentives trigger on fake outcomes.

## 5. Remediation Applied In This Pass

### Backend

- Added `apps/api/src/services/requestAuth.ts`
  - signed wallet authorization for read/write scopes
  - verified bearer auth for Supabase-linked tracking
  - server-side admin passcode validation
- Enforced server-side admin auth for `/api/admin/*`
- Protected wallet-scoped mutation routes:
  - `/api/users/track`
  - `/api/users/username`
  - `/api/users/avatar`
- Protected sensitive read routes:
  - `/api/trade-attempts`
  - `/api/dflow/proof-status`
  - `/api/dflow/positions`
  - `/api/dflow/positions/stream`
  - `/api/integrations/goldrush/wallet-intelligence`
  - `/api/transactions`
- Protected telemetry write routes:
  - `/api/trade-errors/log`
  - `/api/trade-attempts/log`
  - `/api/volume/log`
  - `/api/trades/log`

### Frontend

- Added `apps/web/src/lib/requestAuth.ts`
  - shared wallet signing helpers
  - signed query-string auth for SSE/read paths
  - bearer helper for Supabase session auth
  - admin header helper
- Updated callers to send signed or verified auth:
  - `AuthContext.tsx`
  - `WalletButton.tsx`
  - `onboarding/page.tsx`
  - `settings/page.tsx`
  - `portfolio/page.tsx`
  - `UnifiedBuyPanel.tsx`
  - `useGoldRushWalletIntelligence.ts`
- Reworked the admin page to use real server-validated passcode headers instead of a frontend-only boolean gate
- Added stronger private-key export warning copy

## 6. Verification

Commands run:

```bash
pnpm build:api
pnpm build:web
```

Result:

- API build passed
- Web build passed

## 7. Remaining Recommendations

- Add rate limiting on expensive API and RPC-backed routes.
- Replace passcode-based admin access with real admin RBAC backed by verified sessions.
- Add EVM-signed auth support if Polymarket telemetry should be protected to the same standard as Solana telemetry.
- Add CI jobs for dependency auditing and secret scanning.
- Move operational builder/debug data out of trader-facing UI where it does not provide user value.
