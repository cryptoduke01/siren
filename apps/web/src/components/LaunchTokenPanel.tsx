"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const LAMPORTS_PER_SOL = 1e9;
const inputCls = "w-full px-3 py-1.5 rounded-md text-sm border transition-colors focus:outline-none focus:ring-1";
const labelCls = "text-[11px] font-medium block mb-0.5";

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
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-sm rounded-xl border shadow-xl overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-4 py-2.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <h3 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>Launch Token</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-elevated)]" style={{ color: "var(--text-3)" }} aria-label="Close">✕</button>
          </div>
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {step === "form" && (
              <>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls} style={{ color: "var(--text-2)" }}>Name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Token"
                        className={inputCls}
                        style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                      />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: "var(--text-2)" }}>Symbol</label>
                      <input
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))}
                        placeholder="MTK"
                        className={inputCls}
                        style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--text-2)" }}>Description</label>
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                      placeholder="Short description"
                      className={inputCls}
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--text-2)" }}>Image URL</label>
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      type="url"
                      className={inputCls}
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--text-2)" }}>Initial buy (SOL)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={initialSol}
                      onChange={(e) => setInitialSol(e.target.value)}
                      className={inputCls}
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOptional(!showOptional)}
                    className="flex items-center gap-1 text-[11px]"
                    style={{ color: "var(--text-3)" }}
                  >
                    {showOptional ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Links (optional)
                  </button>
                  {showOptional && (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <input
                        value={twitter}
                        onChange={(e) => setTwitter(e.target.value)}
                        placeholder="Twitter URL"
                        type="url"
                        className={inputCls}
                        style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                      />
                      <input
                        value={telegram}
                        onChange={(e) => setTelegram(e.target.value)}
                        placeholder="Telegram URL"
                        type="url"
                        className={inputCls}
                        style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                      />
                      <input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="Website URL"
                        type="url"
                        className={inputCls}
                        style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={runLaunch}
                  disabled={!name.trim() || !symbol.trim() || !description.trim() || !imageUrl.trim()}
                  className="mt-4 w-full py-2 rounded-lg font-heading font-semibold text-sm transition-opacity disabled:opacity-50"
                  style={{ background: "var(--bags)", color: "var(--accent-text)" }}
                >
                  Launch
                </button>
              </>
            )}
            {(step === "creating" || step === "config" || step === "launching") && (
              <div className="py-6 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--bags)" }} />
                <p className="text-xs" style={{ color: "var(--text-2)" }}>
                  {step === "creating" && "Creating token…"}
                  {step === "config" && "Fee-share config…"}
                  {step === "launching" && "Launching…"}
                </p>
              </div>
            )}
            {step === "done" && (
              <div className="py-4 text-center">
                <p className="font-heading font-semibold text-sm mb-2" style={{ color: "var(--bags)" }}>Token launched</p>
                {createdMint && (
                  <p className="font-mono text-[10px] break-all mb-3" style={{ color: "var(--text-3)" }}>{createdMint}</p>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg font-heading text-sm"
                  style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                >
                  Close
                </button>
              </div>
            )}
            {step === "error" && (
              <div className="py-2">
                <p className="text-sm mb-3" style={{ color: "var(--down)" }}>{error}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setStep("form"); setError(null); }}
                    className="flex-1 py-2 rounded-lg font-body text-sm"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-subtle)" }}
                  >
                    Try again
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 rounded-lg font-heading text-sm"
                    style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
