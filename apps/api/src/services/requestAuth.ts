import type { FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { getSupabaseAdminClient } from "./supabase.js";

const ADMIN_HEADER = "x-siren-admin-passcode";
const WALLET_HEADER = "x-siren-wallet";
const SIGNATURE_HEADER = "x-siren-signature";
const TIMESTAMP_HEADER = "x-siren-timestamp";
const SCOPE_HEADER = "x-siren-scope";
const MAX_AUTH_AGE_MS = 2 * 60 * 1000;

type WalletScope = "read" | "write";

function getHeader(req: FastifyRequest, name: string): string | null {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getQueryValue(req: FastifyRequest, key: string): string | null {
  const query = req.query as Record<string, unknown> | undefined;
  const value = query?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeEquals(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) return false;
  return timingSafeEqual(leftBuf, rightBuf);
}

function getConfiguredAdminPasscode(): string {
  return (
    process.env.ADMIN_PASSCODE?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_PASSCODE?.trim() ||
    ""
  );
}

export function buildWalletAuthMessage({
  wallet,
  scope,
  timestamp,
}: {
  wallet: string;
  scope: WalletScope;
  timestamp: string | number;
}): string {
  return `Siren API auth\nscope:${scope}\nwallet:${wallet.toLowerCase()}\ntimestamp:${timestamp}`;
}

export async function requireAdminPasscode(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const expected = getConfiguredAdminPasscode();
  if (!expected) {
    reply.status(503).send({ success: false, error: "Admin access is not configured on the server." });
    return false;
  }

  const provided = getHeader(req, ADMIN_HEADER);
  if (!provided || !safeEquals(provided, expected)) {
    reply.status(401).send({ success: false, error: "Admin authentication required." });
    return false;
  }

  return true;
}

export async function requireSupabaseAuthUser(
  req: FastifyRequest,
  reply: FastifyReply,
  authUserId: string,
): Promise<boolean> {
  const authHeader = getHeader(req, "authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    reply.status(401).send({ success: false, error: "Authenticated session required." });
    return false;
  }

  const token = authHeader.slice("bearer ".length).trim();
  if (!token) {
    reply.status(401).send({ success: false, error: "Authenticated session required." });
    return false;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      req.log.warn({ err: error }, "supabase auth verification failed");
      reply.status(401).send({ success: false, error: "Authenticated session required." });
      return false;
    }
    if (data.user.id !== authUserId) {
      reply.status(403).send({ success: false, error: "Authenticated user mismatch." });
      return false;
    }
    return true;
  } catch (error) {
    req.log.error(error, "supabase auth verification exception");
    reply.status(503).send({ success: false, error: "Unable to verify authenticated session." });
    return false;
  }
}

export async function requireWalletSignature(
  req: FastifyRequest,
  reply: FastifyReply,
  wallet: string,
  scope: WalletScope,
): Promise<boolean> {
  const expectedWallet = wallet.trim().toLowerCase();
  const providedWallet = (getHeader(req, WALLET_HEADER) ?? getQueryValue(req, "walletAuth"))?.toLowerCase();
  const signature = getHeader(req, SIGNATURE_HEADER) ?? getQueryValue(req, "signature");
  const timestamp = getHeader(req, TIMESTAMP_HEADER) ?? getQueryValue(req, "timestamp");
  const providedScope = (getHeader(req, SCOPE_HEADER) ?? getQueryValue(req, "scope")) as WalletScope | null;

  if (!providedWallet || !signature || !timestamp || !providedScope) {
    reply.status(401).send({ success: false, error: "Signed wallet authorization required." });
    return false;
  }

  if (providedWallet !== expectedWallet) {
    reply
      .status(403)
      .send({ success: false, error: "Signed wallet authorization does not match this wallet." });
    return false;
  }

  if (providedScope !== scope) {
    reply.status(403).send({ success: false, error: "Signed wallet authorization has the wrong scope." });
    return false;
  }

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_AUTH_AGE_MS) {
    reply.status(401).send({ success: false, error: "Signed wallet authorization expired. Please retry." });
    return false;
  }

  let publicKeyBytes: Uint8Array;
  let signatureBytes: Uint8Array;
  try {
    publicKeyBytes = new PublicKey(expectedWallet).toBytes();
    signatureBytes = bs58.decode(signature);
  } catch {
    reply.status(400).send({ success: false, error: "Invalid wallet authorization format." });
    return false;
  }

  const message = buildWalletAuthMessage({ wallet: expectedWallet, scope, timestamp });
  const verified = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    signatureBytes,
    publicKeyBytes,
  );

  if (!verified) {
    reply.status(401).send({ success: false, error: "Wallet signature verification failed." });
    return false;
  }

  return true;
}
