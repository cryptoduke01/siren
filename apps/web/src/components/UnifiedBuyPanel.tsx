"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Copy, Check, Loader2 } from "lucide-react";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1e9;

const MOCK_CHART_DATA = [
  { t: "0h", v: 0.0003 },
  { t: "4h", v: 0.00035 },
  { t: "8h", v: 0.00032 },
  { t: "12h", v: 0.00038 },
  { t: "16h", v: 0.0004 },
  { t: "20h", v: 0.00042 },
  { t: "24h", v: 0.00042 },
];

function CopyCAButton({ mint }: { mint: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const isValid = mint && mint.length >= 32 && !mint.startsWith("mock");
  if (!isValid) return null;
  return (
    <button
      onClick={handleCopy}
      className="mt-2 flex items-center gap-2 text-xs text-siren-text-secondary hover:text-siren-primary transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-siren-bags" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy CA"}
    </button>
  );
}

export function UnifiedBuyPanel() {
  const { selectedMarket, selectedToken, buyPanelOpen, setBuyPanelOpen, setSelectedMarket, setSelectedToken, openForSell } =
    useSirenStore();
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [solAmount, setSolAmount] = useState("0.01");
  const [sellAmount, setSellAmount] = useState("");
  const [sellMode, setSellMode] = useState(false);

  useEffect(() => {
    if (openForSell && selectedToken) setSellMode(true);
  }, [openForSell, selectedToken?.mint]);

  if (!selectedMarket && !selectedToken) return null;

  const onClose = () => {
    setBuyPanelOpen(false);
    setSelectedMarket(null);
    setSelectedToken(null);
    setError(null);
    setSuccess(null);
  };

  const executeJupiterSwap = async () => {
    hapticLight();
    if (!connected || !publicKey || !selectedToken || !signTransaction) {
      setError("Connect your wallet to execute trades.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const isSell = !!sellMode;
      if (isSell) {
        const amountStr = sellAmount?.trim() || "0";
        const amountNum = parseFloat(amountStr);
        if (amountNum <= 0 || !Number.isFinite(amountNum)) {
          setError("Enter a valid token amount to sell.");
          setLoading(false);
          return;
        }
        const decimals = 6;
        const amountInSmallestUnit = BigInt(Math.floor(amountNum * 10 ** decimals));
        const quoteRes = await fetch(
          `${API_URL}/api/jupiter/quote?inputMint=${selectedToken.mint}&outputMint=${NATIVE_SOL_MINT}&amount=${amountInSmallestUnit.toString()}&slippageBps=200`
        );
        const quote = await quoteRes.json();
        if (!quoteRes.ok) {
          const msg = quoteRes.status === 503 && (quote.error || "").toLowerCase().includes("jupiter")
            ? "Jupiter API key not configured. Add JUPITER_API_KEY to apps/api/.env (see .env.example)."
            : (quote.error || quote.message || "Quote failed");
          throw new Error(msg);
        }
        if (quote.error) throw new Error(quote.error || quote.message || "Quote failed");
        const swapRes = await fetch(`${API_URL}/api/jupiter/swap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteResponse: quote, userPublicKey: publicKey.toBase58() }),
        });
        const swapData = await swapRes.json();
        if (!swapRes.ok) {
          const msg = swapRes.status === 503 && (swapData.error || "").toLowerCase().includes("jupiter")
            ? "Jupiter API key not configured. Add JUPITER_API_KEY to apps/api/.env (see .env.example)."
            : (swapData.error || swapData.message || "Swap build failed");
          throw new Error(msg);
        }
        if (swapData.error) throw new Error(swapData.error || swapData.message || "Swap build failed");
        const swapTransactionB64 = swapData.swapTransaction;
        if (!swapTransactionB64) throw new Error("No swap transaction returned");
        const swapTransactionBuf = Buffer.from(swapTransactionB64, "base64");
        const tx = VersionedTransaction.deserialize(swapTransactionBuf);
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
        await connection.confirmTransaction(sig, "confirmed");
        setSuccess(`Sold! Tx: ${sig.slice(0, 8)}...`);
        setSellAmount("");
      } else {
        const amountLamports = Math.floor(parseFloat(solAmount || "0.01") * LAMPORTS_PER_SOL);
        if (amountLamports <= 0) {
          setError("Enter a valid SOL amount.");
          setLoading(false);
          return;
        }
        const quoteRes = await fetch(
          `${API_URL}/api/jupiter/quote?inputMint=${NATIVE_SOL_MINT}&outputMint=${selectedToken.mint}&amount=${amountLamports}&slippageBps=200`
        );
        const quote = await quoteRes.json();
        if (!quoteRes.ok) {
          const msg = quoteRes.status === 503 && (quote.error || "").toLowerCase().includes("jupiter")
            ? "Jupiter API key not configured. Add JUPITER_API_KEY to apps/api/.env (see .env.example)."
            : (quote.error || quote.message || "Quote failed");
          throw new Error(msg);
        }
        if (quote.error) throw new Error(quote.error || quote.message || "Quote failed");
        const swapRes = await fetch(`${API_URL}/api/jupiter/swap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteResponse: quote, userPublicKey: publicKey.toBase58() }),
        });
        const swapData = await swapRes.json();
        if (!swapRes.ok) {
          const msg = swapRes.status === 503 && (swapData.error || "").toLowerCase().includes("jupiter")
            ? "Jupiter API key not configured. Add JUPITER_API_KEY to apps/api/.env (see .env.example)."
            : (swapData.error || swapData.message || "Swap build failed");
          throw new Error(msg);
        }
        if (swapData.error) throw new Error(swapData.error || swapData.message || "Swap build failed");
        const swapTransactionB64 = swapData.swapTransaction;
        if (!swapTransactionB64) throw new Error("No swap transaction returned");
        const swapTransactionBuf = Buffer.from(swapTransactionB64, "base64");
        const tx = VersionedTransaction.deserialize(swapTransactionBuf);
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
        await connection.confirmTransaction(sig, "confirmed");
        setSuccess(`Swap successful! ${sig.slice(0, 8)}...`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap failed";
      if (msg.includes("0x1771") || msg.toLowerCase().includes("slippage")) {
        setError("Price moved (slippage exceeded). Try again or use a smaller amount.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onBuyKalshi = () => {
    if (!connected) {
      setError("Connect your wallet to execute trades.");
      return;
    }
    setError(null);
    window.open("https://kalshi.com/markets", "_blank");
  };

  return (
    <AnimatePresence>
      {buyPanelOpen && (
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
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-siren-bg/90 backdrop-blur-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
              <h3 className="font-heading font-semibold text-siren-primary">Unified Buy Panel</h3>
              <button onClick={onClose} className="text-siren-text-secondary hover:text-siren-text-primary transition-colors p-1 rounded" aria-label="Close">✕</button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedMarket && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                    <p className="text-siren-text-secondary text-xs uppercase mb-1">Kalshi Position</p>
                    <p className="font-heading font-medium text-siren-text-primary text-sm line-clamp-2">{selectedMarket.title}</p>
                    <p className="font-data text-siren-kalshi mt-2">{selectedMarket.probability.toFixed(0)}% YES</p>
                    <a
                      href="https://kalshi.com/markets"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-xs text-siren-kalshi hover:text-siren-primary"
                    >
                      Trade on Kalshi →
                    </a>
                    <button
                      onClick={onBuyKalshi}
                      className="mt-3 w-full py-2.5 bg-siren-kalshi text-siren-bg font-heading font-semibold rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      Buy YES (Kalshi)
                    </button>
                    <button
                      onClick={onBuyKalshi}
                      className="mt-2 w-full py-2 border border-siren-kalshi/50 text-siren-kalshi font-heading font-semibold rounded-lg text-sm hover:bg-siren-kalshi/10 disabled:opacity-50"
                    >
                      Buy NO (Kalshi)
                    </button>
                  </div>
                )}
                {selectedToken && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                    <p className="text-siren-text-secondary text-xs uppercase mb-1">Solana Token</p>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setSellMode(false)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!sellMode ? "bg-siren-bags text-siren-bg" : "bg-white/10 text-siren-text-secondary hover:text-siren-text-primary"}`}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        onClick={() => setSellMode(true)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sellMode ? "bg-siren-bags text-siren-bg" : "bg-white/10 text-siren-text-secondary hover:text-siren-text-primary"}`}
                      >
                        Sell
                      </button>
                    </div>
                    <p className="font-heading font-medium text-siren-text-primary">${selectedToken.symbol}</p>
                    {selectedToken.price != null && (
                      <p className="font-data text-siren-primary text-sm mt-1 tabular-nums">~${selectedToken.price.toFixed(4)} USD</p>
                    )}
                    <p className="font-data text-siren-bags mt-2 text-sm">
                      Vol 24h: {selectedToken.volume24h?.toLocaleString() ?? "-"} SOL
                    </p>
                    {!sellMode ? (
                      <>
                        <div className="mt-3">
                          <label className="text-xs text-siren-text-secondary block mb-1">SOL amount</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={solAmount}
                            onChange={(e) => setSolAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm font-data"
                          />
                        </div>
                        <button
                          onClick={executeJupiterSwap}
                          disabled={loading}
                          className="mt-3 w-full py-2.5 bg-siren-bags text-siren-bg font-heading font-semibold rounded-lg text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Swapping…</> : `Buy ${selectedToken.symbol} (Jupiter)`}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="mt-3">
                          <label className="text-xs text-siren-text-secondary block mb-1">Amount of {selectedToken.symbol} to sell</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm font-data"
                          />
                        </div>
                        <button
                          onClick={executeJupiterSwap}
                          disabled={loading}
                          className="mt-3 w-full py-2.5 bg-siren-bags text-siren-bg font-heading font-semibold rounded-lg text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Selling…</> : `Sell ${selectedToken.symbol} → SOL`}
                        </button>
                      </>
                    )}
                    <div className="h-16 mt-2 rounded-lg overflow-hidden bg-black/20">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={MOCK_CHART_DATA}>
                          <defs>
                            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#00FF85" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#00FF85" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="v" stroke="#00FF85" strokeWidth={1.5} fill="url(#priceGrad)" />
                          <XAxis dataKey="t" hide />
                          <YAxis hide domain={["dataMin", "dataMax"]} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <CopyCAButton mint={selectedToken.mint} />
                  </div>
                )}
              </div>
              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
              {success && <p className="text-siren-bags text-sm mt-3">{success}</p>}
              <p className="text-siren-text-secondary text-xs mt-4">Connect wallet to execute. Kalshi via Kalshi.com; tokens via Jupiter.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
