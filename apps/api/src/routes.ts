import type { FastifyInstance } from "fastify";
import { getMarketsWithVelocity } from "./services/markets.js";
import { getSurfacedTokens, getTokenInfoByMint } from "./services/tokens.js";
import { createTokenInfo, createFeeShareConfig, createLaunchTransaction, getTokenCreators, getTokenClaimStats } from "./services/bags.js";
import { getDflowOrder } from "./services/dflow.js";
import { getSwapOrder } from "./services/swapRouter.js";
import { shouldBlockByCountry } from "./lib/geo-fence.js";
import { getSupabaseAdminClient } from "./services/supabase.js";

const JUPITER_BASE = "https://api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";

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

  /** Access code validation — used by web app to gate terminal on production. Code lives in API env. */
  app.post<{ Body: { code?: string } }>("/api/access/validate", async (req, reply) => {
    const { code } = req.body || {};
    const secret = process.env.SIREN_ACCESS_CODE || "";
    if (!secret || typeof code !== "string" || code.trim() !== secret) {
      return reply.status(403).send({ ok: false, error: "Invalid code" });
    }
    return reply.send({ ok: true });
  });

  /** Admin: list waitlist signups (passcode gate happens on web). */
  app.get<{ Querystring: { limit?: string; offset?: string } }>("/api/admin/waitlist", async (req, reply) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("waitlist_signups")
        .select("id,email,wallet,name,created_at")
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
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("CoinGecko error");
      const json = (await res.json()) as { solana?: { usd?: number } };
      const usd = json.solana?.usd ?? 0;
      return reply.send({ success: true, usd });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to fetch SOL price" });
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
      return reply.send({ success: true, provider: result.provider, transaction: result.transaction });
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
}
