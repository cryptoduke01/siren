"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
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

  const runLaunch = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setError("Connect your wallet first.");
      setStep("error");
      return;
    }
    setError(null);
    const wallet = publicKey.toBase58();
    const initialBuyLamports = Math.floor(parseFloat(initialSol || "0.05") * LAMPORTS_PER_SOL);
    if (initialBuyLamports <= 0) {
      setError("Enter a valid initial SOL amount.");
      setStep("error");
      return;
    }

    try {
      setStep("creating");
      const createRes = await fetch(`${API_URL}/api/bags/create-token-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          symbol,
          description,
          imageUrl,
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
      setError(e instanceof Error ? e.message : "Launch failed");
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
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md rounded-2xl border border-white/10 bg-siren-bg/90 backdrop-blur-xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
            <h3 className="font-heading font-semibold text-siren-primary">Launch Token (Bags)</h3>
            <button onClick={onClose} className="text-siren-text-secondary hover:text-siren-text-primary p-1 rounded" aria-label="Close">✕</button>
          </div>
          <div className="p-6">
            {step === "form" && (
              <>
                <p className="text-siren-text-secondary text-xs mb-4">Create a token and launch on Bags. You need a connected wallet.</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-siren-text-secondary block mb-1">Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Token"
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-siren-text-secondary block mb-1">Symbol</label>
                    <input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))}
                      placeholder="MTK"
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-siren-text-secondary block mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                      placeholder="Short description"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-siren-text-secondary block mb-1">Image URL</label>
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      type="url"
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-siren-text-secondary block mb-1">Twitter URL (optional)</label>
                    <input
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder="https://twitter.com/..."
                      type="url"
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-siren-text-secondary block mb-1">Telegram URL (optional)</label>
                    <input
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="https://t.me/..."
                      type="url"
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-siren-text-secondary block mb-1">Website (optional)</label>
                    <input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                      type="url"
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-siren-text-secondary block mb-1">Initial buy (SOL)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={initialSol}
                      onChange={(e) => setInitialSol(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm font-data"
                    />
                  </div>
                </div>
                <button
                  onClick={runLaunch}
                  disabled={!name || !symbol || !description || !imageUrl}
                  className="mt-5 w-full py-2.5 bg-siren-bags text-siren-bg font-heading font-semibold rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                >
                  Launch token
                </button>
              </>
            )}
            {(step === "creating" || step === "config" || step === "launching") && (
              <div className="py-8 flex flex-col items-center gap-3 text-siren-text-secondary">
                <Loader2 className="w-8 h-8 animate-spin text-siren-bags" />
                <p>
                  {step === "creating" && "Creating token info…"}
                  {step === "config" && "Setting up fee-share & sending config…"}
                  {step === "launching" && "Creating & sending launch transaction…"}
                </p>
              </div>
            )}
            {step === "done" && (
              <div className="py-6 text-center">
                <p className="text-siren-bags font-heading font-semibold mb-2">Token launched</p>
                {createdMint && (
                  <p className="text-siren-text-secondary text-xs break-all mb-4">{createdMint}</p>
                )}
                <button onClick={onClose} className="px-4 py-2 bg-siren-primary/20 text-siren-primary rounded-lg text-sm font-heading">
                  Close
                </button>
              </div>
            )}
            {step === "error" && (
              <div className="py-6">
                <p className="text-red-400 text-sm mb-4">{error}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setStep("form"); setError(null); }} className="px-4 py-2 bg-white/10 text-siren-text-primary rounded-lg text-sm">
                    Back
                  </button>
                  <button onClick={onClose} className="px-4 py-2 bg-siren-primary/20 text-siren-primary rounded-lg text-sm">
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
