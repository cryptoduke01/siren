import type { FastifyInstance } from "fastify";
import { getMarketTradeActivity, getMarketsWithVelocity } from "./services/markets.js";
import { getDflowOrder, getDflowOrderStatus } from "./services/dflow.js";
import { getDflowPositionsForWallet } from "./services/dflowPositions.js";
import { getSwapOrder } from "./services/swapRouter.js";
import { shouldBlockByCountry } from "./lib/geo-fence.js";
import { createDepositAddresses } from "./lib/polymarket.js";
import { getSupabaseAdminClient } from "./services/supabase.js";
import { buildLeaderboard, enrichUsersWithProfiles } from "./services/leaderboard.js";
import {
  sendWelcomeWithAccessCode,
  sendLaunchThreadEmail,
  sendTradingLiveAnnouncementEmail,
  sendExecutionRiskUpdateEmail,
  sendLeaderboardSpotlightEmail,
  canSendEmail,
} from "./services/email.js";
import { getInMemorySignalFeedSnapshot, getSignalFeedSnapshot } from "./services/signalState.js";

const JUPITER_BASE = "https://api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const STABLE_QUOTE_SYMBOLS = new Set(["USD", "USDC", "USDT", "USDS", "USDE"]);
const MARKET_ROUTE_TIMEOUT_MS = 10_000;
const SIGNAL_ROUTE_TIMEOUT_MS = 1_500;
const SIGNAL_ROUTE_CACHE_MS = 5_000;
const SOL_PRICE_ROUTE_TIMEOUT_MS = 4_500;
const SOL_PRICE_CACHE_MS = 60_000;
const DFLOW_PROOF_ROUTE_TIMEOUT_MS = 5_000;
const DFLOW_PROOF_VERIFY_URL = process.env.DFLOW_PROOF_VERIFY_URL?.trim() || "https://proof.dflow.net/verify";

type WaitlistAudienceRow = {
  id: string;
  email: string | null;
  wallet: string | null;
  name: string | null;
  created_at: string;
  access_code: string | null;
  access_code_used_at: string | null;
};

type AppUserAudienceRow = {
  id: string;
  wallet: string | null;
  auth_user_id: string | null;
  created_at: string;
  last_seen_at: string | null;
  signup_source: string | null;
  country: string | null;
  metadata: Record<string, unknown> | null;
};

type UnifiedAudienceRow = {
  email: string;
  name: string | null;
  source: "waitlist" | "app" | "both";
  source_labels: string[];
  waitlist_id: string | null;
  app_user_id: string | null;
  wallets: string[];
  signup_source: string | null;
  country: string | null;
  created_at: string;
  last_seen_at: string | null;
  access_code: string | null;
  access_code_used_at: string | null;
};

type SirenContactRow = {
  email: string;
  name: string | null;
  source: "waitlist" | "app" | "both";
  source_labels: string[] | null;
  waitlist_id: string | null;
  app_user_id: string | null;
  wallets: string[] | null;
  signup_source: string | null;
  country: string | null;
  created_at: string;
  last_seen_at: string | null;
  access_code: string | null;
  access_code_used_at: string | null;
};

function normalizeEmailAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  return normalized;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function pickMetadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value)),
  );
}

function buildUnifiedAudience(
  waitlistRows: WaitlistAudienceRow[],
  appUserRows: AppUserAudienceRow[],
): UnifiedAudienceRow[] {
  const byEmail = new Map<string, UnifiedAudienceRow>();

  for (const row of waitlistRows) {
    const email = normalizeEmailAddress(row.email);
    if (!email) continue;
    byEmail.set(email, {
      email,
      name: row.name?.trim() || null,
      source: "waitlist",
      source_labels: ["waitlist"],
      waitlist_id: row.id,
      app_user_id: null,
      wallets: uniqueStrings([row.wallet]),
      signup_source: null,
      country: null,
      created_at: row.created_at,
      last_seen_at: null,
      access_code: row.access_code,
      access_code_used_at: row.access_code_used_at,
    });
  }

  for (const row of appUserRows) {
    const metadata = normalizeMetadata(row.metadata);
    const email = normalizeEmailAddress(
      pickMetadataString(metadata, ["email", "contact_email", "primary_email"]),
    );
    if (!email) continue;

    const existing = byEmail.get(email);
    const name =
      pickMetadataString(metadata, ["display_name", "full_name", "name", "username"]) ||
      existing?.name ||
      null;

    if (!existing) {
      byEmail.set(email, {
        email,
        name,
        source: "app",
        source_labels: ["app"],
        waitlist_id: null,
        app_user_id: row.id,
        wallets: uniqueStrings([row.wallet]),
        signup_source: row.signup_source,
        country: row.country,
        created_at: row.created_at,
        last_seen_at: row.last_seen_at,
        access_code: null,
        access_code_used_at: null,
      });
      continue;
    }

    existing.name = existing.name || name;
    existing.source = "both";
    existing.source_labels = uniqueStrings([...existing.source_labels, "waitlist", "app"]);
    existing.app_user_id = existing.app_user_id || row.id;
    existing.wallets = uniqueStrings([...existing.wallets, row.wallet]);
    existing.signup_source = existing.signup_source || row.signup_source;
    existing.country = existing.country || row.country;
    existing.last_seen_at = existing.last_seen_at || row.last_seen_at;
  }

  return Array.from(byEmail.values()).sort((a, b) => {
    const left = new Date(a.last_seen_at || a.created_at).getTime();
    const right = new Date(b.last_seen_at || b.created_at).getTime();
    return right - left;
  });
}

async function fetchUnifiedAudience(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  limit = 500,
): Promise<UnifiedAudienceRow[]> {
  const { data, error } = await supabase
    .from("siren_contacts")
    .select("email,name,source,source_labels,waitlist_id,app_user_id,wallets,signup_source,country,created_at,last_seen_at,access_code,access_code_used_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!error && Array.isArray(data)) {
    return (data as SirenContactRow[]).map((row) => ({
      email: row.email,
      name: row.name,
      source: row.source,
      source_labels: row.source_labels ?? [row.source],
      waitlist_id: row.waitlist_id,
      app_user_id: row.app_user_id,
      wallets: row.wallets ?? [],
      signup_source: row.signup_source,
      country: row.country,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
      access_code: row.access_code,
      access_code_used_at: row.access_code_used_at,
    }));
  }

  const [{ data: waitlistRows, error: waitlistError }, { data: appUserRows, error: appUserError }] =
    await Promise.all([
      supabase
        .from("waitlist_signups")
        .select("id,email,wallet,name,created_at,access_code,access_code_used_at")
        .order("created_at", { ascending: false })
        .range(0, limit - 1),
      supabase
        .from("users")
        .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country,metadata")
        .order("created_at", { ascending: false })
        .range(0, limit - 1),
    ]);

  if (waitlistError || appUserError) {
    const fallbackError = waitlistError || appUserError || error;
    throw new Error(fallbackError?.message || "Failed to build audience");
  }

  return buildUnifiedAudience(
    (waitlistRows ?? []) as WaitlistAudienceRow[],
    (appUserRows ?? []) as AppUserAudienceRow[],
  );
}

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

function getTradeErrorStatus(error?: string | null): number {
  const lower = error?.toLowerCase().trim() ?? "";
  /** 422 = app understood the request but could not produce a trade (not an HTTP/proxy fault). */
  if (!lower) return 422;
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
    lower.includes("400") ||
    lower.includes("route_not_found") ||
    lower.includes("route not found")
  ) {
    return 400;
  }
  return 422;
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
      /* CoinGecko failed */
    }

    if (!usd || !Number.isFinite(usd)) {
      try {
        const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", {
          signal: AbortSignal.timeout(3_500),
        });
        if (r.ok) {
          const j = (await r.json()) as { price?: string };
          usd = j.price ? parseFloat(j.price) : 0;
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

  /** Admin: send trading-live product announcement to all waitlist emails. */
  app.post("/api/admin/waitlist/send-trading-live-email", async (_req, reply) => {
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
        const result = await sendTradingLiveAnnouncementEmail({ to: row.email, name: row.name });
        if (result.ok) sent++;
        else {
          failed++;
          failedEmails.push(row.email);
          app.log.warn({ email: row.email, err: result.error }, "Failed to send trading-live email");
        }
      }
      return reply.send({ success: true, sent, failed, skipped, total: entries.length, failedEmails, skippedEmails });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send trading-live emails" });
    }
  });

  /** Admin: send trading-live announcement to pasted emails (must exist in waitlist). */
  app.post<{ Body: { emails?: string[] } }>("/api/admin/waitlist/send-trading-live-email-by-email", async (req, reply) => {
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
      const { data: rows, error: listError } = await supabase.from("waitlist_signups").select("email,name").in("email", normalized);
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
        const result = await sendTradingLiveAnnouncementEmail({ to: row.email, name: row.name });
        if (result.ok) sent++;
        else {
          failed++;
          failedEmails.push(row.email);
          app.log.warn({ email: row.email, err: result.error }, "Failed to send trading-live email (manual)");
        }
      }

      return reply.send({ success: true, sent, failed, skipped, total: normalized.length, failedEmails, skippedEmails });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send trading-live emails (manual)" });
    }
  });

  /** Admin: send leaderboard spotlight announcement to all waitlist emails. */
  app.post("/api/admin/waitlist/send-leaderboard-spotlight-email", async (_req, reply) => {
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
        const result = await sendLeaderboardSpotlightEmail({ to: row.email, name: row.name });
        if (result.ok) sent++;
        else {
          failed++;
          failedEmails.push(row.email);
          app.log.warn({ email: row.email, err: result.error }, "Failed to send leaderboard spotlight email");
        }
      }
      return reply.send({ success: true, sent, failed, skipped, total: entries.length, failedEmails, skippedEmails });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send leaderboard spotlight emails" });
    }
  });

  /** Admin: send leaderboard spotlight to pasted emails (must exist on waitlist). */
  app.post<{ Body: { emails?: string[] } }>("/api/admin/waitlist/send-leaderboard-spotlight-email-by-email", async (req, reply) => {
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
      const { data: rows, error: listError } = await supabase.from("waitlist_signups").select("email,name").in("email", normalized);
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
        const result = await sendLeaderboardSpotlightEmail({ to: row.email, name: row.name });
        if (result.ok) sent++;
        else {
          failed++;
          failedEmails.push(row.email);
          app.log.warn({ email: row.email, err: result.error }, "Failed to send leaderboard spotlight email (manual)");
        }
      }

      return reply.send({ success: true, sent, failed, skipped, total: normalized.length, failedEmails, skippedEmails });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send leaderboard spotlight emails (manual)" });
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

  app.post<{
    Body: {
      wallet?: string;
      venue?: string;
      mode?: string;
      market?: string;
      side?: string;
      inputAsset?: string;
      outputAsset?: string;
      amount?: string;
      status?: string;
      txSignature?: string;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    };
  }>("/api/trade-attempts/log", async (req, reply) => {
    const body = req.body ?? {};
    const payload = {
      wallet: typeof body.wallet === "string" ? body.wallet.trim().toLowerCase() : null,
      venue: typeof body.venue === "string" && body.venue.trim() ? body.venue.trim() : "unknown",
      mode: typeof body.mode === "string" && body.mode.trim() ? body.mode.trim() : "unknown",
      market: typeof body.market === "string" && body.market.trim() ? body.market.trim() : null,
      side: typeof body.side === "string" && body.side.trim() ? body.side.trim() : null,
      input_asset: typeof body.inputAsset === "string" && body.inputAsset.trim() ? body.inputAsset.trim() : null,
      output_asset: typeof body.outputAsset === "string" && body.outputAsset.trim() ? body.outputAsset.trim() : null,
      amount: typeof body.amount === "string" && body.amount.trim() ? body.amount.trim() : null,
      status: typeof body.status === "string" && body.status.trim() ? body.status.trim() : "unknown",
      tx_signature: typeof body.txSignature === "string" && body.txSignature.trim() ? body.txSignature.trim() : null,
      error_message: typeof body.errorMessage === "string" && body.errorMessage.trim() ? body.errorMessage.trim() : null,
      metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {},
    };

    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from("siren_trade_attempts").insert(payload);
      if (error) {
        app.log.warn({ err: error, payload }, "siren_trade_attempts insert skipped");
        return reply.status(202).send({ success: true, persisted: false, warning: error.message || "Trade attempt log skipped" });
      }
      return reply.send({ success: true, persisted: true });
    } catch (e) {
      app.log.warn({ err: e, payload }, "siren_trade_attempts insert skipped with exception");
      return reply.status(202).send({
        success: true,
        persisted: false,
        warning: (e as Error).message || "Trade attempt log skipped",
      });
    }
  });

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

  app.get<{ Querystring: { q: string } }>("/api/markets/search", async (req, reply) => {
    const q = (req.query.q ?? "").trim().toLowerCase();
    if (!q || q.length < 2) return reply.send({ success: true, data: [] });
    try {
      const all = await withTimeout(getMarketsWithVelocity(), MARKET_ROUTE_TIMEOUT_MS, "markets-search");
      const matches = all.filter(
        (m) =>
          m.title?.toLowerCase().includes(q) ||
          m.ticker?.toLowerCase().includes(q) ||
          m.subtitle?.toLowerCase().includes(q)
      );
      if (matches.length > 0) {
        return reply.send({ success: true, data: matches });
      }
      const gammaRes = await fetch(
        `https://gamma-api.polymarket.com/markets?closed=false&limit=20&active=true&_q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6_000) },
      ).catch(() => null);
      if (gammaRes?.ok) {
        const gammaData = (await gammaRes.json()) as Array<{
          condition_id?: string;
          question?: string;
          groupItemTitle?: string;
          outcomePrices?: string;
          volume?: string;
          active?: boolean;
        }>;
        const extra = gammaData
          .filter((m) => m.active !== false && m.question)
          .slice(0, 15)
          .map((m) => {
            const prices = m.outcomePrices ? JSON.parse(m.outcomePrices) : [];
            const yesPrice = parseFloat(prices[0]) || 0.5;
            return {
              ticker: m.condition_id ?? "",
              title: m.question ?? "",
              subtitle: m.groupItemTitle,
              probability: yesPrice * 100,
              volume: parseFloat(m.volume ?? "0"),
              source: "polymarket" as const,
              velocity_1h: 0,
            };
          });
        return reply.send({ success: true, data: extra });
      }
      return reply.send({ success: true, data: [] });
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
  app.post<{ Body: { wallet?: string; authUserId?: string; signupSource?: string; email?: string; name?: string } }>(
    "/api/users/track",
    async (req, reply) => {
      const { wallet, authUserId, signupSource, email, name } = req.body || {};
      if (!wallet && !authUserId) {
        return reply.status(400).send({ success: false, error: "wallet or authUserId required" });
      }

      const normalizedWallet =
        typeof wallet === "string" && wallet.trim().length > 0 ? wallet.trim().toLowerCase() : null;
      const normalizedEmail = normalizeEmailAddress(email);
      const normalizedName = typeof name === "string" && name.trim().length > 0 ? name.trim().slice(0, 80) : null;

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
          .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country,username,display_name,metadata")
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
          if (normalizedEmail || normalizedName) {
            insertPayload.metadata = {
              ...(normalizedEmail ? { email: normalizedEmail } : {}),
              ...(normalizedName ? { name: normalizedName } : {}),
            };
          }

          const { data: inserted, error: insertError } = await supabase
            .from("users")
            .insert(insertPayload)
            .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country,username,display_name,metadata")
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
        if (normalizedEmail || normalizedName) {
          const existingMetadata = normalizeMetadata(existing.metadata);
          updatePayload.metadata = {
            ...existingMetadata,
            ...(normalizedEmail ? { email: normalizedEmail } : {}),
            ...(normalizedName ? { name: normalizedName } : {}),
          };
        }

        const { data: updated, error: updateError } = await supabase
          .from("users")
          .update(updatePayload)
          .eq("id", existing.id)
          .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country,username,display_name,metadata")
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
          .select("id,wallet,username,display_name,avatar_url,created_at,country")
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

  /** Upload profile image to Supabase Storage bucket `avatars` and set users.avatar_url. */
  app.post<{ Body: { wallet: string; imageBase64: string } }>(
    "/api/users/avatar",
    async (req, reply) => {
      const { wallet, imageBase64 } = req.body || {};
      if (!wallet || typeof wallet !== "string" || wallet.trim().length < 20) {
        return reply.status(400).send({ success: false, error: "Valid wallet address required" });
      }
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return reply.status(400).send({ success: false, error: "imageBase64 required" });
      }
      let base64 = imageBase64.trim();
      let mime = "image/jpeg";
      const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(base64);
      if (dataUrlMatch) {
        mime = dataUrlMatch[1] || mime;
        base64 = dataUrlMatch[2] || "";
      }
      if (base64.length > 2_500_000) {
        return reply.status(400).send({ success: false, error: "Image too large" });
      }
      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64, "base64");
      } catch {
        return reply.status(400).send({ success: false, error: "Invalid base64 image" });
      }
      if (buffer.length < 24 || buffer.length > 2_000_000) {
        return reply.status(400).send({ success: false, error: "Invalid image size" });
      }
      const w = wallet.trim().toLowerCase();
      const ext = mime.includes("png") ? "png" : "jpg";
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      const objectPath = `${w.slice(0, 8)}-${w.slice(-6)}.${ext}`;

      try {
        const supabase = getSupabaseAdminClient();
        const { error: upErr } = await supabase.storage.from("avatars").upload(objectPath, buffer, {
          upsert: true,
          contentType,
        });
        if (upErr) {
          req.log.warn({ err: upErr }, "avatar storage upload failed");
          return reply.status(422).send({
            success: false,
            error:
              "Avatar storage failed. In Supabase: create a public bucket named avatars (or fix Storage policies). See apps/api/sql/supabase_avatars_bucket.sql.",
          });
        }
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(objectPath);
        const publicUrl = pub?.publicUrl;
        if (!publicUrl) {
          return reply.status(422).send({ success: false, error: "Could not resolve public URL for avatar" });
        }
        const { data, error } = await supabase
          .from("users")
          .update({ avatar_url: publicUrl })
          .eq("wallet", w)
          .select("id,wallet,avatar_url")
          .maybeSingle();
        if (error) {
          req.log.error({ err: error }, "avatar_url column may be missing");
          return reply.status(422).send({
            success: false,
            error: "Could not save avatar URL. Run apps/api/sql/add_avatar_url.sql on users.",
          });
        }
        return reply.send({ success: true, data: data ?? { wallet: w, avatar_url: publicUrl } });
      } catch (e) {
        app.log.error(e);
        return reply.status(500).send({ success: false, error: "Server error" });
      }
    },
  );

  // ─── Jupiter Swap V2 Proxy ──────────────────────────────────
  const JUP_BASE = "https://api.jup.ag/swap/v2";
  const JUP_API_KEY = process.env.JUPITER_API_KEY || "";
  const jupHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (JUP_API_KEY) h["x-api-key"] = JUP_API_KEY;
    return h;
  };

  app.get<{ Querystring: { inputMint: string; outputMint: string; amount: string; taker?: string; slippageBps?: string } }>(
    "/api/swap/order",
    async (req, reply) => {
      const { inputMint, outputMint, amount, taker, slippageBps } = req.query;
      if (!inputMint || !outputMint || !amount) {
        return reply.status(400).send({ success: false, error: "inputMint, outputMint, amount required" });
      }
      const params = new URLSearchParams({ inputMint, outputMint, amount });
      if (taker) params.set("taker", taker);
      if (slippageBps) params.set("slippageBps", slippageBps);
      try {
        const res = await fetch(`${JUP_BASE}/order?${params.toString()}`, { headers: jupHeaders() });
        if (!res.ok) {
          const text = await res.text();
          return reply.status(res.status).send({ success: false, error: text });
        }
        const data = await res.json();
        return reply.send(data);
      } catch (e) {
        app.log.error(e);
        return reply.status(500).send({ success: false, error: (e as Error).message });
      }
    },
  );

  app.post<{ Body: { signedTransaction: string; requestId: string } }>(
    "/api/swap/execute",
    async (req, reply) => {
      const { signedTransaction, requestId } = req.body || {};
      if (!signedTransaction || !requestId) {
        return reply.status(400).send({ success: false, error: "signedTransaction and requestId required" });
      }
      try {
        const res = await fetch(`${JUP_BASE}/execute`, {
          method: "POST",
          headers: jupHeaders(),
          body: JSON.stringify({ signedTransaction, requestId }),
        });
        const data = await res.json();
        return reply.send(data);
      } catch (e) {
        app.log.error(e);
        return reply.status(500).send({ success: false, error: (e as Error).message });
      }
    },
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

  /**
   * Public leaderboard: **prediction-market traders only** (Kalshi / Polymarket-style logged trades).
   * Query: window=7d|30d|all|alltime, metric=volume|winRate.
   * All-time uses the most recent 25k rows (FIFO win rate) so the route stays bounded.
   */
  app.get<{ Querystring: { window?: string; metric?: string } }>(
    "/api/leaderboard",
    async (req, reply) => {
      const win = (req.query.window || "7d").toLowerCase();
      const window =
        win === "30d" ? "30d" : win === "all" || win === "alltime" ? "all" : "7d";
      const metricRaw = (req.query.metric || "volume").toLowerCase().replace(/_/g, "");
      const metric = metricRaw === "winrate" ? "winRate" : "volume";
      try {
        const client = getSupabaseAdminClient();
        const built = await buildLeaderboard({
          client,
          window,
          metric,
          limit: 50,
        });
        let { entries, ...meta } = built;
        entries = await enrichUsersWithProfiles(client, entries);
        return reply.send({
          success: true,
          data: { ...meta, metric, entries },
        });
      } catch (e) {
        const msg = (e as Error).message || "Leaderboard failed";
        if (msg.includes("Supabase not configured")) {
          return reply.status(503).send({ success: false, error: msg });
        }
        app.log.error(e);
        return reply.status(500).send({ success: false, error: "Leaderboard failed" });
      }
    },
  );

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

  /** Admin: unified email audience across waitlist + app users with email-bearing auth metadata. */
  app.get<{ Querystring: { limit?: string } }>("/api/admin/audience", async (req, reply) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit || "500", 10) || 500, 1), 2000);
    try {
      const supabase = getSupabaseAdminClient();
      const audience = await fetchUnifiedAudience(supabase, limit);
      return reply.send({ success: true, data: audience });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch audience" });
    }
  });

  /** Admin: current email campaign to all deduped contacts. */
  app.post("/api/admin/audience/send-execution-update-email", async (_req, reply) => {
    try {
      const supabase = getSupabaseAdminClient();
      const audience = await fetchUnifiedAudience(supabase, 2000);

      const failedEmails: string[] = [];
      const skippedEmails: string[] = [];
      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const row of audience) {
        if (!row.email?.trim()) {
          skipped += 1;
          skippedEmails.push(row.email || "");
          continue;
        }
        if (!canSendEmail()) {
          skipped += 1;
          skippedEmails.push(row.email);
          continue;
        }
        const result = await sendExecutionRiskUpdateEmail({ to: row.email, name: row.name });
        if (result.ok) {
          sent += 1;
        } else {
          failed += 1;
          failedEmails.push(row.email);
          app.log.warn({ email: row.email, err: result.error }, "Failed to send execution update email");
        }
      }

      return reply.send({ success: true, sent, failed, skipped, total: audience.length, failedEmails, skippedEmails });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send execution update emails" });
    }
  });

  /** Admin: current email campaign to pasted contacts that exist in the unified audience. */
  app.post<{ Body: { emails?: string[] } }>("/api/admin/audience/send-execution-update-email-by-email", async (req, reply) => {
    try {
      const requested = Array.isArray(req.body?.emails) ? req.body.emails : [];
      const normalized = Array.from(
        new Set(
          requested
            .map((email) => normalizeEmailAddress(email))
            .filter((email): email is string => !!email),
        ),
      );
      if (normalized.length === 0) {
        return reply.status(400).send({ success: false, error: "No valid emails provided" });
      }

      const supabase = getSupabaseAdminClient();
      const audienceByEmail = new Map(
        (await fetchUnifiedAudience(supabase, 2000)).map((row) => [row.email, row] as const),
      );

      const failedEmails: string[] = [];
      const skippedEmails: string[] = [];
      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const email of normalized) {
        const row = audienceByEmail.get(email);
        if (!row) {
          skipped += 1;
          skippedEmails.push(email);
          continue;
        }
        if (!canSendEmail()) {
          skipped += 1;
          skippedEmails.push(email);
          continue;
        }
        const result = await sendExecutionRiskUpdateEmail({ to: row.email, name: row.name });
        if (result.ok) {
          sent += 1;
        } else {
          failed += 1;
          failedEmails.push(row.email);
          app.log.warn({ email: row.email, err: result.error }, "Failed to send execution update email (manual)");
        }
      }

      return reply.send({ success: true, sent, failed, skipped, total: normalized.length, failedEmails, skippedEmails });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to send execution update emails" });
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
        const msg = result.error?.trim() || "Trade could not be built. Check DFlow verification, API keys, and try again.";
        return reply.status(getTradeErrorStatus(msg)).send({ success: false, error: msg });
      }
      const txBase64 = result.transaction;
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

  app.get("/api/dflow/positions", async (req, reply) => {
    const { address, wallet } = req.query as { address?: string; wallet?: string };
    const addr = (address ?? wallet ?? "").trim();
    if (!addr) {
      return reply.status(400).send({ success: false, error: "address query param required" });
    }
    try {
      const positions = await getDflowPositionsForWallet(addr);
      if (positions.error) {
        app.log.warn({ wallet: `${addr.slice(0, 6)}...${addr.slice(-4)}`, err: positions.error }, "DFlow positions lookup degraded");
        return reply.status(503).send({ success: false, error: positions.error });
      }
      return reply.send({ success: true, data: positions });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: (e as Error).message || "Failed to fetch DFlow positions" });
    }
  });

  /** Server-driven position updates for portfolio (EventSource). Same payload shape as GET `/api/dflow/positions`. */
  app.get("/api/dflow/positions/stream", async (req, reply) => {
    const { address, wallet } = req.query as { address?: string; wallet?: string };
    const addr = (address ?? wallet ?? "").trim();
    if (!addr) {
      return reply.status(400).send({ success: false, error: "address query param required" });
    }

    const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "";
    const isProd = process.env.NODE_ENV === "production";
    const allowedOrigins = isProd
      ? new Set(["https://onsiren.xyz", "https://www.onsiren.xyz"])
      : null;
    const corsOrigin = !isProd
      ? requestOrigin || "*"
      : requestOrigin && allowedOrigins?.has(requestOrigin)
        ? requestOrigin
        : "https://www.onsiren.xyz";

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": corsOrigin,
      Vary: "Origin",
    });

    let closed = false;
    const endSafe = () => {
      if (closed) return;
      closed = true;
      try {
        reply.raw.end();
      } catch {
        /* ignore */
      }
    };

    const writeSnapshot = async () => {
      if (closed) return;
      try {
        const data = await getDflowPositionsForWallet(addr);
        if (data.error) {
          reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: data.error })}\n\n`);
          return;
        }
        const line = `data: ${JSON.stringify({ success: true, data })}\n\n`;
        reply.raw.write(line);
      } catch (e) {
        const msg = (e as Error).message || "stream tick failed";
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
      }
    };

    await writeSnapshot();
    const interval = setInterval(() => {
      void writeSnapshot();
    }, 12_000);

    req.raw.on("close", () => {
      clearInterval(interval);
      endSafe();
    });
  });
}
