import type { FastifyInstance } from "fastify";
import { getMarketsWithVelocity } from "./services/markets.js";
import { getSurfacedTokens } from "./services/tokens.js";
import { createTokenInfo, createFeeShareConfig, createLaunchTransaction } from "./services/bags.js";
import { getDflowOrder } from "./services/dflow.js";
import { shouldBlockByCountry } from "./lib/geo-fence.js";

const JUPITER_BASE = "https://api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

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
  app.post<{ Body: { name: string; symbol: string; description: string; imageUrl: string } }>(
    "/api/bags/create-token-info",
    async (req, reply) => {
      if (!process.env.BAGS_API_KEY) {
        return reply.status(503).send({
          success: false,
          error: "Bags API key not configured. Add BAGS_API_KEY to apps/api/.env (see .env.example).",
        });
      }
      const { name, symbol, description, imageUrl } = req.body;
      if (!name || !symbol || !description || !imageUrl) {
        return reply.status(400).send({ success: false, error: "name, symbol, description, imageUrl required" });
      }
      try {
        const result = await createTokenInfo({ name, symbol, description, imageUrl });
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
}
