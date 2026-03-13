import type { FastifyInstance } from "fastify";
import bs58 from "bs58";
import { getMarketsWithVelocity } from "./services/markets.js";
import { getSurfacedTokens, getTokenInfoByMint } from "./services/tokens.js";
import { createTokenInfo, createFeeShareConfig, createLaunchTransaction, getTokenCreators, getTokenClaimStats, getBagsPools, getBagsPoolByTokenMint, getTokenLifetimeFees, getBagsTradeQuote, createBagsSwapTransaction } from "./services/bags.js";
import { getDflowOrder } from "./services/dflow.js";
import { getSwapOrder } from "./services/swapRouter.js";
import { shouldBlockByCountry } from "./lib/geo-fence.js";
import { getSupabaseAdminClient } from "./services/supabase.js";
import { sendWelcomeWithAccessCode, canSendEmail } from "./services/email.js";

const JUPITER_BASE = "https://api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";

// In-memory volume store (resets on restart). For persistence, add Supabase/DB.
const volumeStore = new Map<string, Array<{ ts: number; volumeSol: number }>>();
function getVolume7d(): { platform: number; byWallet: Array<{ wallet: string; volume7d: number }> } {
  const dayMs = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - 7 * dayMs;
  let platform = 0;
  const byWallet: Array<{ wallet: string; volume7d: number }> = [];
  for (const [wallet, entries] of volumeStore) {
    const v7d = entries
      .filter((e) => e.ts >= cutoff && typeof e.volumeSol === "number" && Number.isFinite(e.volumeSol))
      .reduce((s, e) => s + e.volumeSol, 0);
    if (v7d > 0) {
      platform += v7d;
      byWallet.push({ wallet, volume7d: v7d });
    }
  }
  byWallet.sort((a, b) => b.volume7d - a.volume7d);
  return { platform, byWallet };
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
        return reply.status(503).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        transaction: result.transaction,
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({
        success: false,
        error: (e as Error).message || "DFlow order failed",
      });
    }
  });

  app.get("/api/markets", async (_req, reply) => {
    try {
      const markets = await getMarketsWithVelocity();
      return reply.send({ success: true, data: markets });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch markets" });
    }
  });

  app.get<{ Querystring: { marketId?: string; categoryId?: string; keywords?: string } }>("/api/tokens", async (req, reply) => {
    const { marketId, categoryId, keywords: keywordsParam } = req.query;
    try {
      const tokens = await getSurfacedTokens(marketId, categoryId, keywordsParam);
      return reply.send({ success: true, data: tokens });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch tokens" });
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

  app.get("/api/sol-price", async (_req, reply) => {
    try {
      let usd = 0;
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {
          headers: { Accept: "application/json" },
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
          const ds = await fetch("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
          if (ds.ok) {
            const j = (await ds.json()) as { pairs?: Array<{ priceUsd?: string }> };
            const p = j.pairs?.[0]?.priceUsd;
            if (p) usd = parseFloat(p) || 0;
          }
        } catch {
          /* fallback failed */
        }
      }
      return reply.send({ success: true, usd: usd && Number.isFinite(usd) ? usd : 0 });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch SOL price" });
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
          .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country")
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
            .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country")
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
          .select("id,wallet,auth_user_id,created_at,last_seen_at,signup_source,country")
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
    if (entries.length > 500) entries.splice(0, entries.length - 500);
    volumeStore.set(w, entries);
    return reply.send({ success: true });
  });

  /** Admin: volume stats (platform total + per wallet 7d). */
  app.get("/api/admin/volume", async (_req, reply) => {
    const { platform, byWallet } = getVolume7d();
    return reply.send({ success: true, data: { platform7d: platform, byWallet } });
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
    Body: { inputMint: string; outputMint: string; amount: string; userPublicKey: string; slippageBps?: number; tryDflowFirst?: boolean };
    Querystring: { countryCode?: string };
  }>("/api/swap/order", async (req, reply) => {
    const { inputMint, outputMint, amount, userPublicKey, slippageBps = 200, tryDflowFirst = true } = req.body || {};
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
      });
      if (result.error || !result.transaction) {
        return reply.status(503).send({ success: false, error: result.error || "Swap failed" });
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
      return reply.send({ success: true, provider: result.provider, transaction: txBase64 });
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
}
