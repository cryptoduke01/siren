"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { Loader2, ChevronDown, ChevronUp, Rocket } from "lucide-react";
import { API_URL } from "@/lib/apiUrl";
const LAMPORTS_PER_SOL = 1e9;

type Step = "form" | "creating" | "config" | "launching" | "done" | "error";

interface FeeShareConfigResponse {
  needsCreation: boolean;
  meteoraConfigKey: string;
  transactions?: Array<{ blockhash: unknown; transaction: string }>;
  bundles?: Array<Array<{ blockhash: unknown; transaction: string }>>;
}

function deserializeAndSend(
  connection: ReturnType<typeof useConnection>["connection"],
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  txBase58: string
): Promise<string> {
  const buf = bs58.decode(txBase58);
  const tx = VersionedTransaction.deserialize(buf);
  return signTransaction(tx).then((signed) =>
    connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
  );
}

function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong. Please try again.";
}

const inputStyle = "w-full px-3 py-2 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--border-active)]";
const labelStyle = "text-[10px] font-medium uppercase tracking-wider block mb-1";

export function LaunchTokenPanel({ onClose }: { onClose: () => void }) {
  const { connected, publicKey, signTransaction } = useSirenWallet();
  const { connection } = useConnection();
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [initialSol, setInitialSol] = useState("0.05");
  const [createdMint, setCreatedMint] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  const runLaunch = async () => {
    setError(null);
    if (!connected || !publicKey || !signTransaction) {
      setError("Connect your wallet first.");
      setStep("error");
      return;
    }
    const n = name.trim();
    const s = symbol.trim().toUpperCase().slice(0, 10);
    const d = description.trim();
    const img = imageUrl.trim();
    if (!n || !s || !d || !img) {
      setError("Name, symbol, description, and image URL are required.");
      setStep("error");
      return;
    }
    const wallet = publicKey.toBase58();
    const solVal = parseFloat(initialSol || "0.05");
    if (!Number.isFinite(solVal) || solVal < 0.01) {
      setError("Enter a valid initial SOL amount (min 0.01).");
      setStep("error");
      return;
    }
    const initialBuyLamports = Math.floor(solVal * LAMPORTS_PER_SOL);

    try {
      setStep("creating");
      const createRes = await fetch(`${API_URL}/api/bags/create-token-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          symbol: s,
          description: d,
          imageUrl: img,
          ...(twitter.trim() && { twitter: twitter.trim() }),
          ...(telegram.trim() && { telegram: telegram.trim() }),
          ...(website.trim() && { website: website.trim() }),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) {
        throw new Error(createData.error || "Create token info failed");
      }
      const { tokenMint, tokenMetadata } = createData.data;
      setCreatedMint(tokenMint);

      setStep("config");
      const configRes = await fetch(`${API_URL}/api/bags/create-fee-share-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payer: wallet, baseMint: tokenMint }),
      });
      const configData = await configRes.json();
      if (!configRes.ok || !configData.success) {
        throw new Error(configData.error || "Fee-share config failed");
      }
      const config: FeeShareConfigResponse = configData.data;
      const configKey = config.meteoraConfigKey;

      if (config.needsCreation) {
        const txs: string[] = [];
        if (config.transactions?.length) {
          config.transactions.forEach((t) => txs.push(t.transaction));
        }
        if (config.bundles?.length) {
          config.bundles.forEach((bundle) => bundle.forEach((t) => txs.push(t.transaction)));
        }
        for (const txBase58 of txs) {
          await deserializeAndSend(connection, signTransaction, txBase58);
        }
      }

      setStep("launching");
      const launchRes = await fetch(`${API_URL}/api/bags/create-launch-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipfs: tokenMetadata,
          tokenMint,
          wallet,
          initialBuyLamports,
          configKey,
        }),
      });
      const launchData = await launchRes.json();
      if (!launchRes.ok || !launchData.success) {
        throw new Error(launchData.error || "Create launch transaction failed");
      }
      const launchTxBase58 = launchData.data?.transaction;
      if (!launchTxBase58) throw new Error("No launch transaction returned");
      const sig = await deserializeAndSend(connection, signTransaction, launchTxBase58);
      await connection.confirmTransaction(sig, "confirmed");
      setStep("done");
      try {
        const key = `siren-bags-launches-${wallet}`;
        const raw = localStorage.getItem(key);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        if (!arr.includes(tokenMint)) arr.push(tokenMint);
        localStorage.setItem(key, JSON.stringify(arr));
      } catch (_) {}
    } catch (e) {
      setError(extractErrorMessage(e));
      setStep("error");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/50" />
      </motion.div>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed top-0 right-0 bottom-0 z-[51] w-full max-w-[400px] flex flex-col"
        style={{
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <h3 className="font-heading font-bold text-sm uppercase tracking-wider" style={{ color: "var(--accent)" }}>Launch Token</h3>
          </div>
          <button onClick={onClose} className="p-2 -m-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: "var(--text-3)" }} aria-label="Close">✕</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {step === "form" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelStyle} style={{ color: "var(--text-3)" }}>Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Token"
                    className={inputStyle}
                    style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                  />
                </div>
                <div>
                  <label className={labelStyle} style={{ color: "var(--text-3)" }}>Symbol</label>
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="MTK"
                    className={inputStyle}
                    style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                  />
                </div>
              </div>
              <div>
                <label className={labelStyle} style={{ color: "var(--text-3)" }}>Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                  placeholder="Short description"
                  className={inputStyle}
                  style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                />
              </div>
              <div>
                <label className={labelStyle} style={{ color: "var(--text-3)" }}>Image URL</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                  className={inputStyle}
                  style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                />
              </div>
              <div>
                <label className={labelStyle} style={{ color: "var(--text-3)" }}>Initial buy (SOL)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={initialSol}
                  onChange={(e) => setInitialSol(e.target.value)}
                  className={inputStyle}
                  style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowOptional(!showOptional)}
                  className="flex items-center gap-1.5 text-[11px] font-medium"
                  style={{ color: "var(--text-3)" }}
                >
                  {showOptional ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Links (optional)
                </button>
                {showOptional && (
                  <div className="mt-2 space-y-2">
                    <input
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder="Twitter URL"
                      type="url"
                      className={inputStyle}
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                    />
                    <input
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="Telegram URL"
                      type="url"
                      className={inputStyle}
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                    />
                    <input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="Website URL"
                      type="url"
                      className={inputStyle}
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={runLaunch}
                disabled={!name.trim() || !symbol.trim() || !description.trim() || !imageUrl.trim()}
                className="w-full py-3 rounded-xl font-heading font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 hover:brightness-110"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Launch on Bags
              </button>
            </div>
          )}
          {(step === "creating" || step === "config" || step === "launching") && (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--accent)" }} />
              <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                {step === "creating" && "Creating token…"}
                {step === "config" && "Fee-share config…"}
                {step === "launching" && "Launching…"}
              </p>
            </div>
          )}
          {step === "done" && (
            <div className="py-8 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--up) 20%, transparent)" }}>
                <Rocket className="w-7 h-7" style={{ color: "var(--up)" }} />
              </div>
              <p className="font-heading font-semibold text-base mb-2" style={{ color: "var(--up)" }}>Token launched</p>
              {createdMint && (
                <p className="font-mono text-[10px] break-all mb-4 px-2" style={{ color: "var(--text-3)" }}>{createdMint}</p>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-heading text-sm font-medium"
                style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)" }}
              >
                Close
              </button>
            </div>
          )}
          {step === "error" && (
            <div className="py-4">
              <p className="font-body text-sm mb-4 p-3 rounded-xl" style={{ background: "color-mix(in srgb, var(--down) 12%, transparent)", color: "var(--down)" }}>{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("form"); setError(null); }}
                  className="flex-1 py-2.5 rounded-xl font-body text-sm font-medium"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-subtle)" }}
                >
                  Try again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl font-heading text-sm font-medium"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
