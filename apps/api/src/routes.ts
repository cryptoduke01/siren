import type { FastifyInstance } from "fastify";
import bs58 from "bs58";
import { getMarketTradeActivity, getMarketsWithVelocity } from "./services/markets.js";
import { getSurfacedTokens, getTokenInfoByMint } from "./services/tokens.js";
import { createTokenInfo, createFeeShareConfig, createLaunchTransaction, getTokenCreators, getTokenClaimStats, getBagsPools, getBagsPoolByTokenMint, getTokenLifetimeFees, getClaimablePositions, getClaimTransactionsV3, getBagsTradeQuote, createBagsSwapTransaction } from "./services/bags.js";
import { getDflowOrder, getDflowOrderStatus } from "./services/dflow.js";
import { getDflowPositionsForWallet } from "./services/dflowPositions.js";
import { getSwapOrder } from "./services/swapRouter.js";
import { shouldBlockByCountry } from "./lib/geo-fence.js";
import { createDepositAddresses } from "./lib/polymarket.js";
import { getSupabaseAdminClient } from "./services/supabase.js";
import { sendWelcomeWithAccessCode, sendLaunchThreadEmail, canSendEmail } from "./services/email.js";
import { getInMemorySignalFeedSnapshot, getSignalFeedSnapshot } from "./services/signalState.js";

const JUPITER_BASE = "https://api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const STABLE_QUOTE_SYMBOLS = new Set(["USD", "USDC", "USDT", "USDS", "USDE"]);
const MARKET_ROUTE_TIMEOUT_MS = 10_000;
const TOKEN_ROUTE_TIMEOUT_MS = 8_000;
const SIGNAL_ROUTE_TIMEOUT_MS = 1_500;
const SIGNAL_ROUTE_CACHE_MS = 5_000;
const SOL_PRICE_ROUTE_TIMEOUT_MS = 4_500;
const SOL_PRICE_CACHE_MS = 60_000;
const DFLOW_PROOF_ROUTE_TIMEOUT_MS = 5_000;
const DFLOW_PROOF_VERIFY_URL = process.env.DFLOW_PROOF_VERIFY_URL?.trim() || "https://proof.dflow.net/verify";

type SolPricePair = {
  chainId?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  baseToken?: { address?: string; symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function pickReliableSolUsdPrice(pairs: SolPricePair[] | undefined): number {
  if (!pairs?.length) return 0;

  const candidates = pairs.filter((pair) => {
    if (pair.chainId !== "solana") return false;
    const baseAddress = pair.baseToken?.address;
    const quoteAddress = pair.quoteToken?.address;
    const baseSymbol = pair.baseToken?.symbol?.toUpperCase();
    const quoteSymbol = pair.quoteToken?.symbol?.toUpperCase();

    const baseIsSol = baseAddress === SOL_MINT;
    const quoteIsSol = quoteAddress === SOL_MINT;
    const baseIsStable = !!baseSymbol && STABLE_QUOTE_SYMBOLS.has(baseSymbol);
    const quoteIsStable = !!quoteSymbol && STABLE_QUOTE_SYMBOLS.has(quoteSymbol);

    return (baseIsSol && quoteIsStable) || (quoteIsSol && baseIsStable);
  });

  const best = candidates.reduce<SolPricePair | null>((currentBest, pair) => {
    if (!currentBest) return pair;
    const pairLiquidity = pair.liquidity?.usd ?? 0;
    const bestLiquidity = currentBest.liquidity?.usd ?? 0;
    if (pairLiquidity !== bestLiquidity) {
      return pairLiquidity > bestLiquidity ? pair : currentBest;
    }
    const pairVolume = pair.volume?.h24 ?? 0;
    const bestVolume = currentBest.volume?.h24 ?? 0;
    return pairVolume > bestVolume ? pair : currentBest;
  }, null);

  const parsed = best?.priceUsd ? parseFloat(best.priceUsd) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTradeErrorStatus(error?: string | null): number {
  const lower = error?.toLowerCase().trim() ?? "";
  if (!lower) return 503;
  if (lower.includes("rate limited") || lower.includes("429")) return 429;
  if (
    lower.includes("wallet must be verified") ||
    lower.includes("unverified_wallet_not_allowed") ||
    lower.includes("dflow.net/proof") ||
    lower.includes("proof verification") ||
    lower.includes("jurisdiction")
  ) {
    return 403;
  }
  if (
    lower.includes("not tradable") ||
    lower.includes("validation error") ||
    lower.includes("insufficient") ||
    lower.includes("slippage") ||
    lower.includes("400")
  ) {
    return 400;
  }
  return 503;
}

let signalRouteCache: { expiresAt: number; value: Awaited<ReturnType<typeof getSignalFeedSnapshot>> } | null = null;
let solPriceCache: { expiresAt: number; value: number } | null = null;
let solPriceInFlight: Promise<number> | null = null;
let ethPriceCache: { expiresAt: number; value: number } | null = null;
let ethPriceInFlight: Promise<number> | null = null;
const BASE_RPC_URL = process.env.BASE_RPC_URL?.trim() || "https://mainnet.base.org";

function buildSignalFeedResponse(snapshot: Awaited<ReturnType<typeof getSignalFeedSnapshot>>) {
  return {
    success: true,
    data: snapshot.signals,
    status: snapshot.status,
    updatedAt: snapshot.updatedAt,
  };
}

async function fetchSolPriceUsd(): Promise<number> {
  if (solPriceCache && solPriceCache.expiresAt > Date.now()) {
    return solPriceCache.value;
  }

  if (solPriceInFlight) {
    return solPriceInFlight;
  }

  solPriceInFlight = (async () => {
    let usd = 0;

    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3_500),
      });
      if (res.ok) {
        const json = (await res.json()) as { solana?: { usd?: number } };
        usd = json.solana?.usd ?? 0;
      }
    } catch {
      /* CoinGecko failed, try DexScreener */
    }

    if (!usd || !Number.isFinite(usd)) {
      try {
        const ds = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SOL_MINT}`, {
          signal: AbortSignal.timeout(3_500),
        });
        if (ds.ok) {
          const json = (await ds.json()) as { pairs?: SolPricePair[] };
          usd = pickReliableSolUsdPrice(json.pairs);
        }
      } catch {
        /* fallback failed */
      }
    }

    const normalized = usd && Number.isFinite(usd) ? usd : 0;
    if (normalized > 0) {
      solPriceCache = {
        expiresAt: Date.now() + SOL_PRICE_CACHE_MS,
        value: normalized,
      };
    }

    return normalized || solPriceCache?.value || 0;
  })().finally(() => {
    solPriceInFlight = null;
  });

  return solPriceInFlight;
}

async function fetchEthPriceUsd(): Promise<number> {
  if (ethPriceCache && ethPriceCache.expiresAt > Date.now()) {
    return ethPriceCache.value;
  }

  if (ethPriceInFlight) {
    return ethPriceInFlight;
  }

  ethPriceInFlight = (async () => {
    let usd = 0;

    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3_500),
      });
      if (res.ok) {
        const json = (await res.json()) as { ethereum?: { usd?: number } };
        usd = json.ethereum?.usd ?? 0;
      }
    } catch {
      /* CoinGecko failed. */
    }

    ethPriceCache = {
      expiresAt: Date.now() + SOL_PRICE_CACHE_MS,
      value: usd,
    };
    ethPriceInFlight = null;
    return usd;
  })();

  return ethPriceInFlight;
}

function isHexEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseEthFromHexWei(value: string): number {
  const wei = BigInt(value);
  return Number(wei) / 1e18;
}

function buildDflowVerifyUrl(address: string): string {
  return DFLOW_PROOF_VERIFY_URL.endsWith("/")
    ? `${DFLOW_PROOF_VERIFY_URL}${encodeURIComponent(address)}`
    : `${DFLOW_PROOF_VERIFY_URL}/${encodeURIComponent(address)}`;
}

async function fetchBaseBalanceEth(address: string): Promise<number> {
  const response = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
    signal: AbortSignal.timeout(6_000),
  });

  if (!response.ok) {
    throw new Error(`Base RPC error: ${response.status}`);
  }

  const payload = (await response.json()) as { result?: string; error?: { message?: string } };
  if (payload.error) {
    throw new Error(payload.error.message || "Base RPC returned an error");
  }
  if (typeof payload.result !== "string") {
    throw new Error("Base RPC did not return a balance");
  }

  return parseEthFromHexWei(payload.result);
}

const MAX_VOLUME_WALLETS = 200;
const MAX_VOLUME_ENTRIES_PER_WALLET = 200;
const volumeStore = new Map<string, Array<{ ts: number; volumeSol: number }>>();
function getVolumeStats(): {
  platform7d: number;
  platform30d: number;
  platformAllTime: number;
  byWallet: Array<{ wallet: string; volume7d: number; volume30d: number; volumeAllTime: number }>;
} {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const cutoff7 = now - 7 * dayMs;
  const cutoff30 = now - 30 * dayMs;
  let platform7d = 0;
  let platform30d = 0;
  let platformAllTime = 0;
  const byWallet: Array<{ wallet: string; volume7d: number; volume30d: number; volumeAllTime: number }> = [];

  for (const [wallet, entries] of volumeStore) {
    let vAll = 0;
    let v7 = 0;
    let v30 = 0;
    for (const e of entries) {
      const v = typeof e.volumeSol === "number" && Number.isFinite(e.volumeSol) ? e.volumeSol : 0;
      if (v <= 0) continue;
      vAll += v;
      if (e.ts >= cutoff30) v30 += v;
      if (e.ts >= cutoff7) v7 += v;
    }
    if (vAll > 0) {
      platformAllTime += vAll;
      platform30d += v30;
      platform7d += v7;
      byWallet.push({ wallet, volume7d: v7, volume30d: v30, volumeAllTime: vAll });
    }
  }
  byWallet.sort((a, b) => b.volume7d - a.volume7d);
  return { platform7d, platform30d, platformAllTime, byWallet };
}

function getDailyPlatformVolumeStats(days: number): { day: string; volumeSol: number }[] {
  const safeDays = Math.min(Math.max(days || 14, 1), 30);
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const startMs = now - (safeDays - 1) * dayMs;

  const buckets = Array.from({ length: safeDays }, (_, i) => {
    const ts = startMs + i * dayMs;
    return {
      day: new Date(ts).toISOString().slice(0, 10),
      volumeSol: 0,
    };
  });

  for (const [, entries] of volumeStore) {
    for (const e of entries) {
      if (!e || typeof e.volumeSol !== "number" || !Number.isFinite(e.volumeSol) || e.volumeSol <= 0) continue;
      if (typeof e.ts !== "number" || !Number.isFinite(e.ts)) continue;
      if (e.ts < startMs) continue;
      const idx = Math.floor((e.ts - startMs) / dayMs);
      if (idx < 0 || idx >= buckets.length) continue;
      buckets[idx].volumeSol += e.volumeSol;
    }
  }

  return buckets;
}

export function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

  /** Waitlist signup. Store in DB/CRM when ready. Reject if email already exists. */
  app.post<{ Body: { email: string; wallet?: string; name?: string; building?: string } }>("/api/waitlist", async (req, reply) => {
    const { email, wallet, name } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return reply.status(400).send({ success: false, error: "Valid email required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const supabase = getSupabaseAdminClient();

      const { data: existingData, error: selectError } = await supabase
        .from("waitlist_signups")
        .select("id")
        .eq("email", normalizedEmail);

      if (selectError) {
        app.log.error({ err: selectError }, "Waitlist duplicate check failed");
        return reply.status(503).send({ success: false, error: "Cannot check waitlist. Please try again." });
      }

      const existingList = Array.isArray(existingData) ? existingData : [];
      if (existingList.length > 0) {
        return reply.status(409).send({ success: false, error: "You're already on the waitlist." });
      }

      const payload = {
        email: normalizedEmail,
        wallet: wallet?.trim() || null,
        name: name?.trim() || null,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("waitlist_signups").insert(payload);
      if (error) {
        app.log.error({ err: error }, "Supabase waitlist insert failed");
        const isDuplicate = error.code === "23505" || (error.message && /duplicate|unique|already exists/i.test(error.message));
        const message = isDuplicate ? "You're already on the waitlist." : (error.message || "Waitlist insert failed");
        return reply.status(isDuplicate ? 409 : 503).send({ success: false, error: message });
      }
      return reply.send({ success: true, message: "Thanks for joining the waitlist" });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to join waitlist" });
    }
  });

  /** Access code validation — master code (env) or per-waitlist codes (one-time use). */
  app.post<{ Body: { code?: string } }>("/api/access/validate", async (req, reply) => {
    const { code } = req.body || {};
    const trimmed = typeof code === "string" ? code.trim() : "";
    if (!trimmed) return reply.status(403).send({ ok: false, error: "Invalid code" });
    const master = process.env.SIREN_ACCESS_CODE || "";
    if (master && trimmed === master) return reply.send({ ok: true });
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("waitlist_signups")
        .update({ access_code_used_at: new Date().toISOString() })
        .eq("access_code", trimmed)
        .is("access_code_used_at", null)
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!error && data) return reply.send({ ok: true });
    } catch {
      /* ignore */
    }
    return reply.status(403).send({ ok: false, error: "Invalid or already used code" });
  });

  /** Admin: generate access code for a waitlist signup and send welcome email. */
  app.post<{ Params: { id: string } }>("/api/admin/waitlist/:id/generate-code", async (req, reply) => {
    const id = req.params.id?.trim();
    if (!id) return reply.status(400).send({ success: false, error: "id required" });
    const code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
    try {
      const supabase = getSupabaseAdminClient();
      const { data: row, error: selectError } = await supabase
        .from("waitlist_signups")
        .select("email, name")
        .eq("id", id)
        .single();
      if (selectError || !row) return reply.status(404).send({ success: false, error: "Waitlist entry not found" });
      const { data, error } = await supabase
        .from("waitlist_signups")
        .update({ access_code: code, access_code_used_at: null })
        .eq("id", id)
        .select("access_code")
        .single();
      if (error) return reply.status(503).send({ success: false, error: error.message || "Update failed" });
      let emailSent = false;
      if (canSendEmail() && row.email) {
        const result = await sendWelcomeWithAccessCode({ to: row.email, name: row.name, code });
        emailSent = result.ok;
        if (!result.ok) app.log.warn({ email: row.email, err: result.error }, "Failed to send welcome email");
      }
      return reply.send({
        success: true,
        code: data?.access_code ?? code,
        emailSent: canSendEmail() ? emailSent : null,
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to generate code" });
    }
  });

  /** Admin: resend access-code email to a single waitlist signup (uses existing code). */
  app.post<{ Params: { id: string } }>("/api/admin/waitlist/:id/resend-email", async (req, reply) => {
    const id = req.params.id?.trim();
    if (!id) return reply.status(400).send({ success: false, error: "id required" });
    try {
      const supabase = getSupabaseAdminClient();
      const { data: row, error: selectError } = await supabase
        .from("waitlist_signups")
        .select("email, name, access_code")
        .eq("id", id)
        .single();
      if (selectError || !row) return reply.status(404).send({ success: false, error: "Waitlist entry not found" });
      if (!row.access_code) return reply.status(400).send({ success: false, error: "No access code. Generate one first." });
      if (!row.email?.trim()) return reply.status(400).send({ success: false, error: "No email for this signup." });
      let emailSent = false;
      if (canSendEmail()) {
        const result = await sendWelcomeWithAccessCode({ to: row.email, name: row.name, code: row.access_code });
        emailSent = result.ok;
        if (!result.ok) app.log.warn({ email: row.email, err: result.error }, "Failed to resend welcome email");
      }
      return reply.send({ success: true, emailSent: canSendEmail() ? emailSent : null });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to resend email" });
    }
  });

  /** Admin: send access-code emails to all waitlist entries (generate codes for those without). */
  app.post("/api/admin/waitlist/send-all-codes", async (req, reply) => {
    try {
      const supabase = getSupabaseAdminClient();
      const { data: rows, error: listError } = await supabase
        .from("waitlist_signups")
        .select("id,email,name,access_code")
        .not("email", "is", null)
        .order("created_at", { ascending: true })
        .limit(500);
      if (listError) return reply.status(503).send({ success: false, error: listError.message || "Query failed" });
      const entries = rows ?? [];
      let sent = 0;
      let failed = 0;
      let skipped = 0;
      const failedEmails: string[] = [];
      const skippedEmails: string[] = [];
      for (const row of entries) {
        if (!row.email?.trim()) {
          skipped++;
          skippedEmails.push(row.email || "");
          continue;
        }
        let code = row.access_code;
        if (!code) {
          code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
          const { error: updateErr } = await supabase
            .from("waitlist_signups")
            .update({ access_code: code, access_code_used_at: null })
            .eq("id", row.id);
          if (updateErr) {
            failed++;
            app.log.warn({ id: row.id, email: row.email }, "Failed to generate code");
            failedEmails.push(row.email);
            continue;
          }
        }
        if (!canSendEmail()) {
          skipped++;
          skippedEmails.push(row.email);
          continue;
        }
        const result = await sendWelcomeWithAccessCode({ to: row.email, name: row.name, code });
        if (result.ok) sent++;
        else {
          failed++;
          app.log.warn({ email: row.email, err: result.error }, "Failed to send email");
          failedEmails.push(row.email);
        }
      }
      return reply.send({ success: true, sent, failed, skipped, total: entries.length, failedEmails, skippedEmails });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send emails" });
    }
  });

  /** Admin: send launch-thread email to all waitlist signups with email. */
  app.post("/api/admin/waitlist/send-launch-thread-email", async (_req, reply) => {
    try {
      const supabase = getSupabaseAdminClient();
      const { data: rows, error: listError } = await supabase
        .from("waitlist_signups")
        .select("email,name")
        .not("email", "is", null)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (listError) return reply.status(503).send({ success: false, error: listError.message || "Query failed" });
      const entries = rows ?? [];
      let sent = 0;
      let failed = 0;
      let skipped = 0;
      const failedEmails: string[] = [];
      const skippedEmails: string[] = [];
      for (const row of entries) {
        if (!row.email?.trim()) {
          skipped++;
          skippedEmails.push(row.email || "");
          continue;
        }
        if (!canSendEmail()) {
          skipped++;
          skippedEmails.push(row.email);
          continue;
        }
        const result = await sendLaunchThreadEmail({ to: row.email, name: row.name });
        if (result.ok) sent++;
        else {
          failed++;
          failedEmails.push(row.email);
          app.log.warn({ email: row.email, err: result.error }, "Failed to send launch thread email");
        }
      }
      return reply.send({ success: true, sent, failed, skipped, total: entries.length, failedEmails, skippedEmails });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send launch thread emails" });
    }
  });

  /** Admin: send launch-thread email to a specific list of emails (pasted manually). */
  app.post<{ Body: { emails?: string[] } }>("/api/admin/waitlist/send-launch-thread-email-by-email", async (req, reply) => {
    try {
      const raw = Array.isArray(req.body?.emails) ? req.body.emails : [];
      const normalized = Array.from(
        new Set(
          raw
            .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
            .filter((e) => e.length > 0)
        )
      );
      if (normalized.length === 0) {
        return reply.status(400).send({ success: false, error: "No valid emails provided" });
      }

      const supabase = getSupabaseAdminClient();
      const { data: rows, error: listError } = await supabase
        .from("waitlist_signups")
        .select("email,name")
        .in("email", normalized);
      if (listError) {
        return reply.status(503).send({ success: false, error: listError.message || "Query failed" });
      }

      const byEmail = new Map<string, (typeof rows)[number]>();
      for (const row of rows ?? []) {
        if (row.email) byEmail.set(row.email.toLowerCase(), row as any);
      }

      let sent = 0;
      let failed = 0;
      let skipped = 0;
      const failedEmails: string[] = [];
      const skippedEmails: string[] = [];

      for (const email of normalized) {
        const row = byEmail.get(email);
        if (!row || !row.email?.trim()) {
          skipped++;
          skippedEmails.push(email);
          continue;
        }
        if (!canSendEmail()) {
          skipped++;
          skippedEmails.push(email);
          continue;
        }
        const result = await sendLaunchThreadEmail({ to: row.email, name: row.name });
        if (result.ok) sent++;
        else {
          failed++;
          failedEmails.push(row.email);
          app.log.warn({ email: row.email, err: result.error }, "Failed to send launch thread email (manual)");
        }
      }

      return reply.send({ success: true, sent, failed, skipped, total: normalized.length, failedEmails, skippedEmails });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send launch thread emails (manual)" });
    }
  });

  /** Admin: send access-code emails to a specific list of emails (pasted manually). */
  app.post<{ Body: { emails?: string[] } }>("/api/admin/waitlist/send-codes-by-email", async (req, reply) => {
    try {
      const raw = Array.isArray(req.body?.emails) ? req.body.emails : [];
      const normalized = Array.from(
        new Set(
          raw
            .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
            .filter((e) => e.length > 0)
        )
      );
      if (normalized.length === 0) {
        return reply.status(400).send({ success: false, error: "No valid emails provided" });
      }

      const supabase = getSupabaseAdminClient();
      const { data: rows, error: listError } = await supabase
        .from("waitlist_signups")
        .select("id,email,name,access_code")
        .in("email", normalized);
      if (listError) {
        return reply.status(503).send({ success: false, error: listError.message || "Query failed" });
      }

      const byEmail = new Map<string, (typeof rows)[number]>();
      for (const row of rows ?? []) {
        if (row.email) byEmail.set(row.email.toLowerCase(), row as any);
      }

      let sent = 0;
      let failed = 0;
      let skipped = 0;
      const failedEmails: string[] = [];
      const skippedEmails: string[] = [];

      for (const email of normalized) {
        const row = byEmail.get(email);
        if (!row) {
          skipped++;
          skippedEmails.push(email);
          continue;
        }

        let code = row.access_code as string | null;
        if (!code) {
          code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
          const { error: updateErr } = await supabase
            .from("waitlist_signups")
            .update({ access_code: code, access_code_used_at: null })
            .eq("id", row.id);
          if (updateErr) {
            failed++;
            app.log.warn({ id: row.id, email: row.email }, "Failed to generate code (manual)");
            failedEmails.push(email);
            continue;
          }
        }

        if (!canSendEmail()) {
          skipped++;
          skippedEmails.push(email);
          continue;
        }

        const result = await sendWelcomeWithAccessCode({ to: row.email as string, name: row.name as string | null, code });
        if (result.ok) {
          sent++;
        } else {
          failed++;
          failedEmails.push(email);
          app.log.warn({ email: row.email, err: result.error }, "Failed to send email (manual)");
        }
      }

      return reply.send({
        success: true,
        sent,
        failed,
        skipped,
        total: normalized.length,
        failedEmails,
        skippedEmails,
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send emails" });
    }
  });

  /** Admin: list waitlist signups (passcode gate happens on web). */
  app.get<{ Querystring: { limit?: string; offset?: string } }>("/api/admin/waitlist", async (req, reply) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("waitlist_signups")
        .select("id,email,wallet,name,created_at,access_code,access_code_used_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return reply.status(503).send({ success: false, error: error.message || "Query failed" });
      return reply.send({ success: true, data: data ?? [] });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch waitlist" });
    }
  });

  /** Admin: delete a waitlist signup by id. */
  app.delete<{ Params: { id: string } }>("/api/admin/waitlist/:id", async (req, reply) => {
    const { id } = req.params;
    if (!id?.trim()) return reply.status(400).send({ success: false, error: "id required" });
    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from("waitlist_signups").delete().eq("id", id.trim());
      if (error) return reply.status(503).send({ success: false, error: error.message || "Delete failed" });
      return reply.send({ success: true });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to delete" });
    }
  });

  /** DFlow prediction market order: get quote + transaction. Geo-fenced for US/restricted. */
  app.get<{ Querystring: { countryCode?: string } }>("/api/prediction-markets/eligibility", async (req, reply) => {
    const countryCode =
      (req.query.countryCode as string) ||
      (req.headers["cf-ipcountry"] as string) ||
      (req.headers["x-country-code"] as string) ||
      null;
    const blocked = shouldBlockByCountry(countryCode);
    return reply.send({
      success: true,
      data: {
        blocked,
        countryCode,
        reason: blocked ? "Prediction market trading is not available in your jurisdiction." : null,
      },
    });
  });

  app.post<{ Body: { venue?: string; mode?: string; market?: string; side?: string; inputAsset?: string; amount?: string; wallet?: string; message?: string } }>(
    "/api/trade-errors/log",
    async (req, reply) => {
      const body = req.body ?? {};
      const message = typeof body.message === "string" ? body.message : "";
      const lower = message.toLowerCase();
      const payload = {
        venue: body.venue ?? "unknown",
        mode: body.mode ?? "unknown",
        market: body.market ?? null,
        side: body.side ?? null,
        inputAsset: body.inputAsset ?? null,
        amount: body.amount ?? null,
        wallet: typeof body.wallet === "string" ? `${body.wallet.slice(0, 6)}...${body.wallet.slice(-4)}` : null,
        message,
      };

      if (lower.includes("insufficient")) {
        app.log.info(payload, "Trade failure reported: insufficient funds");
      } else {
        app.log.warn(payload, "Trade failure reported");
      }

      return reply.send({ success: true });
    }
  );

  app.get<{ Querystring: { address?: string } }>("/api/dflow/proof-status", async (req, reply) => {
    const address = req.query.address?.trim();
    if (!address) {
      return reply.status(400).send({ success: false, error: "address required" });
    }

    try {
      const response = await withTimeout(
        fetch(buildDflowVerifyUrl(address), {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(DFLOW_PROOF_ROUTE_TIMEOUT_MS),
        }),
        DFLOW_PROOF_ROUTE_TIMEOUT_MS,
        "dflow-proof-status"
      );

      if (!response.ok) {
        return reply.status(503).send({
          success: false,
          error: `Proof verify failed: ${response.status}`,
        });
      }

      const payload = (await response.json()) as { verified?: boolean };
      return reply.send({
        success: true,
        data: {
          address,
          verified: Boolean(payload.verified),
        },
      });
    } catch (error) {
      app.log.warn(error, "Unable to verify DFlow proof status");
      return reply.status(503).send({
        success: false,
        error: "Unable to verify wallet status right now.",
      });
    }
  });

  app.post<{ Body: { address?: string } }>("/api/polymarket/deposit-addresses", async (req, reply) => {
    const address = req.body?.address?.trim();
    if (!address) {
      return reply.status(400).send({ success: false, error: "address required" });
    }

    try {
      const payload = await withTimeout(createDepositAddresses(address), 10_000, "polymarket-deposit-addresses");
      return reply.send({
        success: true,
        data: payload,
      });
    } catch (error) {
      app.log.warn(error, "Unable to create Polymarket deposit addresses");
      return reply.status(503).send({
        success: false,
        error: "Unable to create Polymarket deposit addresses right now.",
      });
    }
  });

  /** DFlow prediction market order: get quote + transaction. Geo-fenced for US/restricted. */
  app.get<{
    Querystring: { outputMint: string; amount: string; userPublicKey: string; inputMint?: string; slippageBps?: string; countryCode?: string };
  }>("/api/dflow/order", async (req, reply) => {
    const { outputMint, amount, userPublicKey, inputMint, slippageBps = "200", countryCode } = req.query;
    const country =
      (countryCode as string) ||
      (req.headers["cf-ipcountry"] as string) ||
      (req.headers["x-country-code"] as string);

    if (country && shouldBlockByCountry(country)) {
      return reply.status(403).send({
        success: false,
        error: "Prediction market trading is not available in your jurisdiction.",
      });
    }

    if (!outputMint || !amount || !userPublicKey) {
      return reply.status(400).send({
        success: false,
        error: "outputMint, amount, userPublicKey required",
      });
    }

    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const effectiveInputMint = inputMint === USDC_MINT ? USDC_MINT : SOL_MINT;

    try {
      const result = await getDflowOrder({
        inputMint: effectiveInputMint,
        outputMint,
        amount,
        userPublicKey,
        slippageBps: parseInt(slippageBps, 10) || 200,
        predictionMarketSlippageBps: 500,
      });

      if (result.error) {
        app.log.warn({ outputMint: outputMint?.slice(0, 8), amount, inputMint: effectiveInputMint }, result.error);
        return reply.status(getTradeErrorStatus(result.error)).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        transaction: result.transaction,
        executionMode: result.executionMode,
        lastValidBlockHeight: result.lastValidBlockHeight,
        inAmount: result.inAmount,
        outAmount: result.outAmount,
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({
        success: false,
        error: (e as Error).message || "DFlow order failed",
      });
    }
  });

  app.get<{ Querystring: { signature: string; lastValidBlockHeight?: string } }>("/api/dflow/order-status", async (req, reply) => {
    const { signature, lastValidBlockHeight } = req.query;
    if (!signature?.trim()) {
      return reply.status(400).send({ success: false, error: "signature required" });
    }
    try {
      const result = await getDflowOrderStatus(
        signature.trim(),
        lastValidBlockHeight ? Number(lastValidBlockHeight) : undefined
      );
      if (result.error) {
        return reply.status(503).send({ success: false, error: result.error });
      }
      return reply.send({ success: true, data: result });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "DFlow order status failed" });
    }
  });

  app.get("/api/markets", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    try {
      const markets = await withTimeout(getMarketsWithVelocity(), MARKET_ROUTE_TIMEOUT_MS, "markets");
      return reply.send({ success: true, data: markets });
    } catch (e) {
      app.log.warn(e);
      return reply.send({ success: true, data: [] });
    }
  });

  app.get("/api/signals", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
    if (signalRouteCache && signalRouteCache.expiresAt > Date.now()) {
      return reply.send(buildSignalFeedResponse(signalRouteCache.value));
    }

    try {
      const snapshot = await withTimeout(getSignalFeedSnapshot(), SIGNAL_ROUTE_TIMEOUT_MS, "signals");
      signalRouteCache = {
        expiresAt: Date.now() + SIGNAL_ROUTE_CACHE_MS,
        value: snapshot,
      };
      return reply.send(buildSignalFeedResponse(snapshot));
    } catch (e) {
      app.log.warn(e);
      return reply.send(buildSignalFeedResponse(signalRouteCache?.value ?? getInMemorySignalFeedSnapshot()));
    }
  });

  app.get<{ Params: { ticker: string } }>("/api/markets/:ticker/activity", async (req, reply) => {
    const ticker = req.params.ticker?.trim();
    if (!ticker) {
      return reply.status(400).send({ success: false, error: "ticker required" });
    }
    try {
      const activity = await getMarketTradeActivity(ticker);
      return reply.send({ success: true, data: activity });
    } catch (e) {
      app.log.error(e);
      return reply.status(503).send({ success: false, error: (e as Error).message || "Failed to fetch market activity" });
    }
  });

  app.get<{ Querystring: { marketId?: string; categoryId?: string; keywords?: string } }>("/api/tokens", async (req, reply) => {
    const { marketId, categoryId, keywords: keywordsParam } = req.query;
    try {
      const tokens = await withTimeout(
        getSurfacedTokens(marketId, categoryId, keywordsParam),
        TOKEN_ROUTE_TIMEOUT_MS,
        "tokens"
      );
      return reply.send({ success: true, data: tokens });
    } catch (e) {
      app.log.warn(e);
      return reply.send({ success: true, data: [] });
    }
  });

  // ─── Real trending tokens (DexScreener top boosted) ──────────
  app.get("/api/trending", async (_req, reply) => {
    try {
      const { getTopBoostedTokens, getTokenPairs } = await import("./services/dexscreener.js");
      const boosted = await withTimeout(getTopBoostedTokens(), 8_000, "trending-boosted");
      const top = boosted.slice(0, 20);
      const enriched = await Promise.allSettled(
        top.map(async (t) => {
          const pairs = await getTokenPairs(t.tokenAddress).catch(() => []);
          const best = pairs.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))[0];
          return {
            mint: t.tokenAddress,
            symbol: best?.baseToken?.symbol ?? t.symbol ?? "???",
            name: best?.baseToken?.name ?? t.name ?? "Unknown",
            imageUrl: t.icon ?? best?.info?.imageUrl ?? undefined,
            priceUsd: best?.priceUsd ? parseFloat(best.priceUsd) : undefined,
            volume24h: best?.volume?.h24 ?? undefined,
            marketCap: best?.marketCap ?? best?.fdv ?? undefined,
            liquidity: best?.liquidity?.usd ?? undefined,
            dexUrl: t.url ?? undefined,
          };
        })
      );
      const data = enriched
        .filter((r): r is PromiseFulfilledResult<ReturnType<typeof Object>> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((t) => t.priceUsd);
      return reply.send({ success: true, data });
    } catch (e) {
      _req.log.error(e);
      return reply.send({ success: true, data: [] });
    }
  });

  app.get<{ Querystring: { mint: string } }>("/api/token-info", async (req, reply) => {
    const { mint } = req.query;
    if (!mint?.trim()) {
      return reply.status(400).send({ success: false, error: "mint required" });
    }
    try {
      const info = await getTokenInfoByMint(mint.trim());
      if (!info) return reply.send({ success: true, data: null });
      return reply.send({ success: true, data: info });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch token info" });
    }
  });

  /** Tweets mentioning a token CA (X API v2). Requires TWITTER_BEARER_TOKEN. */
  app.get<{ Querystring: { mint: string } }>("/api/token-tweets", async (req, reply) => {
    const { mint } = req.query;
    if (!mint?.trim() || mint.length < 32) {
      return reply.status(400).send({ success: false, error: "Valid mint (CA) required" });
    }
    const bearer = process.env.TWITTER_BEARER_TOKEN?.trim();
    if (!bearer) {
      return reply.status(503).send({ success: false, error: "X API not configured. Set TWITTER_BEARER_TOKEN." });
    }
    try {
      const cleanMint = mint.trim();
      const info = await getTokenInfoByMint(cleanMint).catch(() => null);
      const symbol = info?.symbol?.trim();
      const safeSymbol =
        symbol && symbol.length >= 2 && symbol.length <= 10 && !["token", "unknown"].includes(symbol.toLowerCase())
          ? symbol
          : null;
      const queryParts = [`"${cleanMint}"`];
      if (safeSymbol) queryParts.push(`$${safeSymbol}`);
      const query = `(${queryParts.join(" OR ")}) lang:en -is:retweet`;
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,author_id,text,public_metrics`;
      req.log.info(
        { mint: cleanMint, query, bearerConfigured: Boolean(process.env.TWITTER_BEARER_TOKEN?.trim()) },
        "token-tweets query"
      );
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json" },
      });
      const data = (await res.json()) as {
        data?: Array<{ id: string; text: string; created_at?: string; author_id?: string }>;
        error?: { message?: string };
        title?: string;
        detail?: string;
        errors?: Array<{ message?: string }>;
      };
      if (!res.ok) {
        return reply.status(res.status >= 500 ? 503 : res.status).send({
          success: false,
          error: data.detail ?? data.errors?.[0]?.message ?? data.error?.message ?? data.title ?? "X API error",
        });
      }
      const tweets = data.data ?? [];
      return reply.send({ success: true, data: tweets });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch tweets" });
    }
  });

  app.get("/api/sol-price", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    try {
      const usd = await withTimeout(fetchSolPriceUsd(), SOL_PRICE_ROUTE_TIMEOUT_MS, "sol-price");
      return reply.send({ success: true, usd });
    } catch (e) {
      app.log.warn(e);
      return reply.send({ success: true, usd: solPriceCache?.value ?? 0 });
    }
  });

  app.get("/api/eth-price", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    try {
      const usd = await withTimeout(fetchEthPriceUsd(), SOL_PRICE_ROUTE_TIMEOUT_MS, "eth-price");
      return reply.send({ success: true, usd });
    } catch (e) {
      app.log.warn(e);
      return reply.send({ success: true, usd: ethPriceCache?.value ?? 0 });
    }
  });

  app.get<{ Querystring: { address: string } }>("/api/base/balance", async (req, reply) => {
    reply.header("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    const address = req.query.address?.trim();
    if (!address || !isHexEvmAddress(address)) {
      return reply.status(400).send({ success: false, error: "Valid EVM address required" });
    }

    try {
      const eth = await withTimeout(fetchBaseBalanceEth(address), 6_000, "base-balance");
      return reply.send({
        success: true,
        data: {
          chain: "base",
          address,
          eth,
        },
      });
    } catch (e) {
      app.log.warn(e);
      return reply.status(503).send({ success: false, error: (e as Error).message || "Failed to fetch Base balance" });
    }
  });

  // Track or upsert a user by wallet / auth id
  app.post<{ Body: { wallet?: string; authUserId?: string; signupSource?: string } }>(
    "/api/users/track",
    async (req, reply) => {
      const { wallet, authUserId, signupSource } = req.body || {};
      if (!wallet && !authUserId) {
        return reply.status(400).send({ success: false, error: "wallet or authUserId required" });
      }

      const normalizedWallet =
        typeof wallet === "string" && wallet.trim().length > 0 ? wallet.trim().toLowerCase() : null;

      // Auto-detect country from IP geo headers (no user permission needed)
      const country =
        (req.headers["cf-ipcountry"] as string) ||
        (req.headers["x-vercel-ip-country"] as string) ||
        (req.headers["x-country-code"] as string) ||
        null;
      const countryCode = country && country.length === 2 ? country.toUpperCase() : null;

      try {
        const supabase = getSupabaseAdminClient();

        const filters: string[] = [];
        if (normalizedWallet) filters.push(`wallet.eq.${normalizedWallet}`);
        if (authUserId) filters.push(`auth_user_id.eq.${authUserId}`);

        const { data: existing, error: selectError } = await supabase
          .from("users")
          .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country,username,display_name")
          .or(filters.join(","))
          .limit(1)
          .maybeSingle();

        if (selectError && selectError.code !== "PGRST116") {
          req.log.error({ err: selectError }, "users.track select failed");
          return reply.status(503).send({ success: false, error: "User lookup failed" });
        }

        const now = new Date().toISOString();

        if (!existing) {
          const insertPayload: Record<string, unknown> = {
            created_at: now,
            last_seen_at: now,
            signup_source: signupSource ?? (authUserId ? "auth" : "wallet"),
          };
          if (normalizedWallet) insertPayload.wallet = normalizedWallet;
          if (authUserId) insertPayload.auth_user_id = authUserId;
          if (countryCode) insertPayload.country = countryCode;

          const { data: inserted, error: insertError } = await supabase
            .from("users")
            .insert(insertPayload)
            .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country,username,display_name")
            .single();

          if (insertError) {
            req.log.error({ err: insertError }, "users.track insert failed");
            return reply.status(503).send({ success: false, error: "User insert failed" });
          }

          return reply.send({ success: true, data: inserted });
        }

        const updatePayload: Record<string, unknown> = {
          last_seen_at: now,
        };
        if (!existing.wallet && normalizedWallet) updatePayload.wallet = normalizedWallet;
        if (!existing.auth_user_id && authUserId) updatePayload.auth_user_id = authUserId;
        if (!existing.signup_source && signupSource) updatePayload.signup_source = signupSource;
        if (countryCode) updatePayload.country = countryCode;

        const { data: updated, error: updateError } = await supabase
          .from("users")
          .update(updatePayload)
          .eq("id", existing.id)
          .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country,username,display_name")
          .single();

        if (updateError) {
          req.log.error({ err: updateError }, "users.track update failed");
          return reply.status(503).send({ success: false, error: "User update failed" });
        }

        return reply.send({ success: true, data: updated });
      } catch (e) {
        app.log.error(e);
        return reply.status(500).send({ success: false, error: "User tracking failed" });
      }
    }
  );

  // ─── Username Profile ───────────────────────────────────────
  app.post<{ Body: { wallet: string; username: string } }>(
    "/api/users/username",
    async (req, reply) => {
      const { wallet, username } = req.body || {};
      if (!wallet || typeof wallet !== "string" || wallet.trim().length < 20) {
        return reply.status(400).send({ success: false, error: "Valid wallet address required" });
      }
      if (!username || typeof username !== "string") {
        return reply.status(400).send({ success: false, error: "Username required" });
      }
      const clean = username.trim().slice(0, 20).replace(/[^a-zA-Z0-9_.\-]/g, "");
      if (clean.length < 2) {
        return reply.status(400).send({ success: false, error: "Username must be 2–20 chars (letters, numbers, _ . -)." });
      }
      try {
        const supabase = getSupabaseAdminClient();
        const { data: dup } = await supabase
          .from("users")
          .select("id")
          .eq("username", clean.toLowerCase())
          .neq("wallet", wallet.trim().toLowerCase())
          .maybeSingle();
        if (dup) {
          return reply.status(409).send({ success: false, error: "Username already taken" });
        }
        const { data, error } = await supabase
          .from("users")
          .update({ username: clean.toLowerCase(), display_name: clean })
          .eq("wallet", wallet.trim().toLowerCase())
          .select("id,wallet,username,display_name")
          .single();
        if (error) {
          if (error.code === "PGRST116") {
            return reply.status(404).send({ success: false, error: "Wallet not found. Connect your wallet first." });
          }
          req.log.error({ err: error }, "username update failed");
          return reply.status(503).send({ success: false, error: "Failed to update username" });
        }
        return reply.send({ success: true, data });
      } catch (e) {
        app.log.error(e);
        return reply.status(500).send({ success: false, error: "Server error" });
      }
    }
  );

  app.get<{ Querystring: { wallet: string } }>(
    "/api/users/profile",
    async (req, reply) => {
      const wallet = (req.query.wallet || "").trim().toLowerCase();
      if (!wallet || wallet.length < 20) {
        return reply.status(400).send({ success: false, error: "wallet query param required" });
      }
      try {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from("users")
          .select("id,wallet,username,display_name,created_at,country")
          .eq("wallet", wallet)
          .maybeSingle();
        if (error && error.code !== "PGRST116") {
          req.log.error({ err: error }, "profile lookup failed");
          return reply.status(503).send({ success: false, error: "Lookup failed" });
        }
        return reply.send({ success: true, data: data ?? null });
      } catch (e) {
        app.log.error(e);
        return reply.status(500).send({ success: false, error: "Server error" });
      }
    }
  );

  /** Log volume (called by client after swaps). No auth for simplicity; can add later. */
  app.post<{ Body: { wallet: string; volumeSol: number } }>("/api/volume/log", async (req, reply) => {
    const { wallet, volumeSol } = req.body || {};
    if (!wallet || typeof wallet !== "string" || typeof volumeSol !== "number" || !Number.isFinite(volumeSol) || volumeSol <= 0) {
      return reply.status(400).send({ success: false, error: "wallet and volumeSol (positive number) required" });
    }
    const w = wallet.trim();
    if (w.length < 32) return reply.status(400).send({ success: false, error: "Invalid wallet" });
    const entries = volumeStore.get(w) ?? [];
    entries.push({ ts: Date.now(), volumeSol });
    if (entries.length > MAX_VOLUME_ENTRIES_PER_WALLET) entries.splice(0, entries.length - MAX_VOLUME_ENTRIES_PER_WALLET);
    volumeStore.set(w, entries);
    if (volumeStore.size > MAX_VOLUME_WALLETS) {
      const oldest = volumeStore.keys().next().value;
      if (oldest) volumeStore.delete(oldest);
    }
    return reply.send({ success: true });
  });

  /** Admin: volume stats (platform + per wallet, 7d / 30d / all-time). */
  app.get("/api/admin/volume", async (_req, reply) => {
    const stats = getVolumeStats();
    return reply.send({ success: true, data: stats });
  });

  /** Admin: daily platform volume series (for dashboard charts). */
  app.get<{ Querystring: { days?: string } }>("/api/admin/volume/daily", async (req, reply) => {
    const days = Number.parseInt(req.query.days || "14", 10);
    const series = getDailyPlatformVolumeStats(Number.isFinite(days) ? days : 14);
    return reply.send({ success: true, data: { series } });
  });

  /** Admin: aggregate user stats for dashboard. */
  app.get("/api/admin/users/stats", async (_req, reply) => {
    try {
      const supabase = getSupabaseAdminClient();
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const since24 = new Date(now - dayMs).toISOString();
      const since7d = new Date(now - 7 * dayMs).toISOString();

      const [{ count: totalUsers, error: totalErr }, { count: new24h, error: new24Err }, { count: new7d, error: new7dErr }, { count: active24h, error: activeErr }] =
        await Promise.all([
          supabase.from("users").select("id", { count: "exact", head: true }),
          supabase.from("users").select("id", { count: "exact", head: true }).gte("created_at", since24),
          supabase.from("users").select("id", { count: "exact", head: true }).gte("created_at", since7d),
          supabase.from("users").select("id", { count: "exact", head: true }).gte("last_seen_at", since24),
        ]);

      const firstError = totalErr || new24Err || new7dErr || activeErr;
      if (firstError) {
        app.log.error({ err: firstError }, "admin users stats failed");
        return reply.status(503).send({ success: false, error: "Failed to fetch user stats" });
      }

      return reply.send({
        success: true,
        data: {
          totalUsers: totalUsers ?? 0,
          newUsers24h: new24h ?? 0,
          newUsers7d: new7d ?? 0,
          activeUsers24h: active24h ?? 0,
        },
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch user stats" });
    }
  });

  /** Trades: log buys/sells permanently for open-position tracking + PnL. */
  app.post<{
    Body: {
      wallet: string;
      mint: string;
      side: "buy" | "sell";
      tokenAmount: number | null;
      priceUsd: number | null;
      tokenName?: string | null;
      tokenSymbol?: string | null;
      txSignature?: string | null;
      timestamp?: number | null;
    };
  }>("/api/trades/log", async (req, reply) => {
    const {
      wallet,
      mint,
      side,
      tokenAmount,
      priceUsd,
      tokenName = null,
      tokenSymbol = null,
      txSignature = null,
      timestamp,
    } = req.body || {};

    if (!wallet || typeof wallet !== "string" || wallet.length < 32) {
      return reply.status(400).send({ success: false, error: "Valid wallet required" });
    }
    if (!mint || typeof mint !== "string" || mint.length < 32) {
      return reply.status(400).send({ success: false, error: "Valid mint required" });
    }
    if (side !== "buy" && side !== "sell") {
      return reply.status(400).send({ success: false, error: "side must be buy or sell" });
    }

    try {
      const supabase = getSupabaseAdminClient();
      const executedAt = typeof timestamp === "number" && Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
      const { error } = await supabase.from("siren_trades").insert({
        wallet: wallet.trim(),
        mint: mint.trim(),
        side,
        token_amount: tokenAmount,
        price_usd: priceUsd,
        token_name: tokenName,
        token_symbol: tokenSymbol,
        tx_signature: txSignature,
        executed_at: executedAt.toISOString(),
      });

      if (error) {
        app.log.warn({ err: error, wallet: wallet.slice(0, 8), mint: mint.slice(0, 8) }, "siren_trades insert skipped");
        return reply.status(202).send({
          success: true,
          persisted: false,
          warning: error.message || "Trade log skipped",
        });
      }

      return reply.send({ success: true, persisted: true });
    } catch (e) {
      app.log.warn(e, "siren_trades insert skipped with exception");
      return reply.status(202).send({
        success: true,
        persisted: false,
        warning: (e as Error).message || "Trade log skipped",
      });
    }
  });

  /** Admin: list app users (wallet-connected users from users table). */
  app.get<{ Querystring: { limit?: string; offset?: string } }>("/api/admin/users", async (req, reply) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit || "100", 10) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("users")
        .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country,metadata")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return reply.status(503).send({ success: false, error: error.message || "Query failed" });
      return reply.send({ success: true, data: data ?? [] });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch app users" });
    }
  });

  /** Wallet transaction history via Helius Enhanced Transactions API. */
  app.get<{ Querystring: { address: string; limit?: string; cursor?: string } }>("/api/transactions", async (req, reply) => {
    const key = process.env.HELIUS_API_KEY;
    if (!key) {
      return reply.status(503).send({ success: false, error: "Helius API key not configured. Add HELIUS_API_KEY to apps/api/.env" });
    }
    const { address, limit = "20", cursor } = req.query;
    if (!address?.trim()) {
      return reply.status(400).send({ success: false, error: "address required" });
    }
    try {
      const params = new URLSearchParams({ "api-key": key, limit });
      if (cursor) params.set("before", cursor);
      const res = await fetch(
        `https://api.helius.xyz/v0/addresses/${encodeURIComponent(address.trim())}/transactions?${params}`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      if (!res.ok) return reply.status(res.status).send(data);
      return reply.send({ success: true, data: Array.isArray(data) ? data : [] });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch transactions" });
    }
  });

  /** Unified swap: DFlow first for prediction market tokens, Jupiter fallback. */
  app.post<{
    Body: { inputMint: string; outputMint: string; amount: string; userPublicKey: string; slippageBps?: number; tryDflowFirst?: boolean; forcePredictionMarket?: boolean };
    Querystring: { countryCode?: string };
  }>("/api/swap/order", async (req, reply) => {
    const { inputMint, outputMint, amount, userPublicKey, slippageBps = 200, tryDflowFirst = true, forcePredictionMarket = false } = req.body || {};
    const countryCode = (req.body as { countryCode?: string })?.countryCode ?? req.query.countryCode ?? req.headers["cf-ipcountry"] ?? req.headers["x-country-code"];
    if (!inputMint || !outputMint || !amount || !userPublicKey) {
      return reply.status(400).send({ success: false, error: "inputMint, outputMint, amount, userPublicKey required" });
    }
    try {
      const result = await getSwapOrder({
        inputMint,
        outputMint,
        amount,
        userPublicKey,
        slippageBps: Number(slippageBps) || 200,
        tryDflowFirst,
        countryCode: countryCode as string | undefined,
        forcePredictionMarket,
      });
      if (result.error || !result.transaction) {
        return reply.status(getTradeErrorStatus(result.error)).send({ success: false, error: result.error || "Swap failed" });
      }
      let txBase64 = result.transaction;
      if (result.provider === "bags" || result.provider === "dflow") {
        try {
          const buf = Buffer.from(bs58.decode(result.transaction));
          txBase64 = buf.toString("base64");
        } catch {
          return reply.status(500).send({ success: false, error: "Invalid transaction format" });
        }
      }
      return reply.send({
        success: true,
        provider: result.provider,
        transaction: txBase64,
        executionMode: result.executionMode,
        lastValidBlockHeight: result.lastValidBlockHeight,
        inAmount: result.inAmount,
        outAmount: result.outAmount,
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Swap failed" });
    }
  });

  /** Jupiter swap quote proxy. Requires JUPITER_API_KEY. Basic: 1 RPS. */
  app.get<{ Querystring: { inputMint: string; outputMint: string; amount: string; slippageBps?: string } }>(
    "/api/jupiter/quote",
    async (req, reply) => {
      const { inputMint, outputMint, amount, slippageBps = "50" } = req.query;
      if (!inputMint || !outputMint || !amount) {
        return reply.status(400).send({ success: false, error: "inputMint, outputMint, amount required" });
      }
      const key = process.env.JUPITER_API_KEY;
      if (!key) {
        return reply.status(503).send({
          success: false,
          error: "Jupiter API key not configured. Add JUPITER_API_KEY to apps/api/.env (see .env.example).",
        });
      }
      try {
        const qs = new URLSearchParams({ inputMint, outputMint, amount, slippageBps });
        const res = await fetch(`${JUPITER_BASE}/swap/v1/quote?${qs}`, {
          headers: { "x-api-key": key, Accept: "application/json" },
        });
        const data = await res.json();
        if (!res.ok) return reply.status(res.status).send(data);
        return reply.send(data);
      } catch (e) {
        app.log.error(e);
        return reply.status(500).send({ success: false, error: "Jupiter quote failed" });
      }
    }
  );

  /** Jupiter swap transaction. POST { quoteResponse, userPublicKey }. */
  app.post<{ Body: { quoteResponse: unknown; userPublicKey: string } }>("/api/jupiter/swap", async (req, reply) => {
    const { quoteResponse, userPublicKey } = req.body;
    if (!quoteResponse || !userPublicKey) {
      return reply.status(400).send({ success: false, error: "quoteResponse, userPublicKey required" });
    }
    const key = process.env.JUPITER_API_KEY;
    if (!key) {
      return reply.status(503).send({
        success: false,
        error: "Jupiter API key not configured. Add JUPITER_API_KEY to apps/api/.env (see .env.example).",
      });
    }
    try {
      const res = await fetch(`${JUPITER_BASE}/swap/v1/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, Accept: "application/json" },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          dynamicComputeUnitLimit: true,
          dynamicSlippage: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) return reply.status(res.status).send(data);
      return reply.send(data);
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Jupiter swap failed" });
    }
  });

  /** Bags token launch step 1: create token info. Returns tokenMint + tokenMetadata for create-launch-transaction. */
  app.post<{ Body: { name: string; symbol: string; description: string; imageUrl: string; telegram?: string; twitter?: string; website?: string } }>(
    "/api/bags/create-token-info",
    async (req, reply) => {
      if (!process.env.BAGS_API_KEY) {
        return reply.status(503).send({
          success: false,
          error: "Bags API key not configured. Add BAGS_API_KEY to apps/api/.env (see .env.example).",
        });
      }
      const { name, symbol, description, imageUrl, telegram, twitter, website } = req.body;
      if (!name || !symbol || !description || !imageUrl) {
        return reply.status(400).send({ success: false, error: "name, symbol, description, imageUrl required" });
      }
      try {
        const result = await createTokenInfo({ name, symbol, description, imageUrl, telegram, twitter, website });
        return reply.send({ success: true, data: result });
      } catch (e) {
        app.log.error(e);
        return reply.status(500).send({ success: false, error: (e as Error).message || "Bags create-token-info failed" });
      }
    }
  );

  app.post<{ Body: { payer: string; baseMint: string } }>("/api/bags/create-fee-share-config", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({
        success: false,
        error: "Bags API key not configured. Add BAGS_API_KEY to apps/api/.env (see .env.example).",
      });
    }
    const { payer, baseMint } = req.body;
    if (!payer || !baseMint) return reply.status(400).send({ success: false, error: "payer, baseMint required" });
    try {
      const result = await createFeeShareConfig(payer, baseMint);
      return reply.send({ success: true, data: result });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags fee-share config failed" });
    }
  });

  app.post<{
    Body: { ipfs: string; tokenMint: string; wallet: string; initialBuyLamports: number; configKey: string };
  }>("/api/bags/create-launch-transaction", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({
        success: false,
        error: "Bags API key not configured. Add BAGS_API_KEY to apps/api/.env (see .env.example).",
      });
    }
    const { ipfs, tokenMint, wallet, initialBuyLamports, configKey } = req.body;
    if (!ipfs || !tokenMint || !wallet || initialBuyLamports == null || !configKey) {
      return reply.status(400).send({ success: false, error: "ipfs, tokenMint, wallet, initialBuyLamports, configKey required" });
    }
    try {
      const tx = await createLaunchTransaction({ ipfs, tokenMint, wallet, initialBuyLamports, configKey });
      return reply.send({ success: true, data: { transaction: tx } });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags launch tx failed" });
    }
  });

  app.get<{ Querystring: { tokenMint: string } }>("/api/bags/token-creators", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({ success: false, error: "Bags API key not configured." });
    }
    const { tokenMint } = req.query;
    if (!tokenMint?.trim()) return reply.status(400).send({ success: false, error: "tokenMint required" });
    try {
      const creators = await getTokenCreators(tokenMint.trim());
      return reply.send({ success: true, data: creators });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags token-creators failed" });
    }
  });

  app.get<{ Querystring: { tokenMint: string } }>("/api/bags/claim-stats", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({ success: false, error: "Bags API key not configured." });
    }
    const { tokenMint } = req.query;
    if (!tokenMint?.trim()) return reply.status(400).send({ success: false, error: "tokenMint required" });
    try {
      const stats = await getTokenClaimStats(tokenMint.trim());
      return reply.send({ success: true, data: stats });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags claim-stats failed" });
    }
  });

  app.get<{ Querystring: { wallet: string } }>("/api/bags/my-launches", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({ success: false, error: "Bags API key not configured." });
    }
    const { wallet } = req.query;
    if (!wallet?.trim()) return reply.status(400).send({ success: false, error: "wallet required" });
    const w = wallet.trim().toLowerCase();
    try {
      const pools = await getBagsPools(false);
      const mints: string[] = [];
      const toCheck = pools.filter((p) => p.tokenMint.toLowerCase().endsWith("bags"));
      for (const p of toCheck) {
        try {
          const creators = await getTokenCreators(p.tokenMint);
          const isCreator = creators.some((c) => (c.wallet ?? "").toLowerCase() === w);
          if (isCreator) mints.push(p.tokenMint);
        } catch {
          // skip
        }
      }
      return reply.send({ success: true, data: mints });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags my-launches failed" });
    }
  });

  app.get<{ Querystring: { onlyMigrated?: string } }>("/api/bags/pools", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({ success: false, error: "Bags API key not configured." });
    }
    try {
      const onlyMigrated = req.query.onlyMigrated === "true";
      const pools = await getBagsPools(onlyMigrated);
      return reply.send({ success: true, data: pools });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags pools failed" });
    }
  });

  app.get<{ Querystring: { tokenMint: string } }>("/api/bags/pool", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({ success: false, error: "Bags API key not configured." });
    }
    const { tokenMint } = req.query;
    if (!tokenMint?.trim()) return reply.status(400).send({ success: false, error: "tokenMint required" });
    try {
      const pool = await getBagsPoolByTokenMint(tokenMint.trim());
      return reply.send({ success: true, data: pool });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags pool failed" });
    }
  });

  app.get<{ Querystring: { tokenMint: string } }>("/api/bags/token/lifetime-fees", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({ success: false, error: "Bags API key not configured." });
    }
    const { tokenMint } = req.query;
    if (!tokenMint?.trim()) return reply.status(400).send({ success: false, error: "tokenMint required" });
    try {
      const fees = await getTokenLifetimeFees(tokenMint.trim());
      return reply.send({ success: true, data: fees });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags lifetime-fees failed" });
    }
  });

  /** Bags: claimable fee positions for a wallet. */
  app.get<{ Querystring: { wallet: string } }>("/api/bags/claimable-positions", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({ success: false, error: "Bags API key not configured." });
    }
    const { wallet } = req.query;
    if (!wallet?.trim()) return reply.status(400).send({ success: false, error: "wallet required" });
    try {
      const positions = await getClaimablePositions(wallet.trim());
      return reply.send({ success: true, data: positions });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags claimable-positions failed" });
    }
  });

  /** Bags: claim transactions for a token. Returns txs for user to sign/send. */
  app.post<{ Body: { feeClaimer: string; tokenMint: string } }>("/api/bags/claim-txs", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({ success: false, error: "Bags API key not configured." });
    }
    const { feeClaimer, tokenMint } = req.body || {};
    if (!feeClaimer?.trim() || !tokenMint?.trim()) {
      return reply.status(400).send({ success: false, error: "feeClaimer and tokenMint required" });
    }
    try {
      const txs = await getClaimTransactionsV3(feeClaimer.trim(), tokenMint.trim());
      return reply.send({ success: true, data: txs });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags claim-txs failed" });
    }
  });

  app.get<{ Querystring: { inputMint: string; outputMint: string; amount: string; slippageBps?: string } }>(
    "/api/bags/trade/quote",
    async (req, reply) => {
      if (!process.env.BAGS_API_KEY) {
        return reply.status(503).send({ success: false, error: "Bags API key not configured." });
      }
      const { inputMint, outputMint, amount, slippageBps } = req.query;
      if (!inputMint || !outputMint || !amount) {
        return reply.status(400).send({ success: false, error: "inputMint, outputMint, amount required" });
      }
      try {
        const quote = await getBagsTradeQuote({
          inputMint,
          outputMint,
          amount,
          slippageMode: slippageBps ? "manual" : "auto",
          slippageBps: slippageBps ? parseInt(slippageBps, 10) : undefined,
        });
        return reply.send({ success: true, data: quote });
      } catch (e) {
        app.log.error(e);
        return reply.status(500).send({ success: false, error: (e as Error).message || "Bags trade quote failed" });
      }
    }
  );

  app.post<{ Body: { quoteResponse: unknown; userPublicKey: string } }>("/api/bags/trade/swap", async (req, reply) => {
    if (!process.env.BAGS_API_KEY) {
      return reply.status(503).send({ success: false, error: "Bags API key not configured." });
    }
    const { quoteResponse, userPublicKey } = req.body || {};
    if (!quoteResponse || !userPublicKey) {
      return reply.status(400).send({ success: false, error: "quoteResponse, userPublicKey required" });
    }
    try {
      const tx = await createBagsSwapTransaction(quoteResponse, userPublicKey);
      return reply.send({ success: true, data: { transaction: tx } });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Bags trade swap failed" });
    }
  });

  app.get("/api/dflow/positions", async (req, reply) => {
    const { address, wallet } = req.query as { address?: string; wallet?: string };
    const addr = (address ?? wallet ?? "").trim();
    if (!addr) {
      return reply.status(400).send({ success: false, error: "address query param required" });
    }
    try {
      const positions = await getDflowPositionsForWallet(addr);
      return reply.send({ success: true, data: positions });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Failed to fetch DFlow positions" });
    }
  });
}
