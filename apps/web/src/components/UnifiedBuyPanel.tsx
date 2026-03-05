"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { useSirenStore } from "@/store/useSirenStore";
import { useToastStore } from "@/store/useToastStore";
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
      className="mt-2 flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors duration-100"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[var(--accent-bags)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy CA"}
    </button>
  );
}

export function UnifiedBuyPanel() {
  const { selectedMarket, selectedToken, buyPanelOpen, buyPanelMode, setBuyPanelOpen, setSelectedMarket, setSelectedToken, openForSell } =
    useSirenStore();
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const addToast = useToastStore((s) => s.addToast);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [solAmount, setSolAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellMode, setSellMode] = useState(false);

  useEffect(() => {
    if (openForSell && selectedToken) setSellMode(true);
  }, [openForSell, selectedToken?.mint]);

  if (!buyPanelOpen) return null;
  if (buyPanelMode === "market" && !selectedMarket) return null;
  if (buyPanelMode === "token" && !selectedToken) return null;

  const onClose = () => {
    setBuyPanelOpen(false);
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
        const amountStr = solAmount?.trim() || "";
        const amountNum = parseFloat(amountStr);
        if (!amountStr || amountNum <= 0 || !Number.isFinite(amountNum)) {
          setError("Enter a valid SOL amount (e.g. 0.01).");
          setLoading(false);
          return;
        }
        const amountLamports = Math.floor(amountNum * LAMPORTS_PER_SOL);
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
      const friendly = msg.includes("0x1771") || msg.toLowerCase().includes("slippage") ? "Price moved. Try a smaller amount." : msg;
      setError(friendly);
      addToast(friendly, "error");
    } finally {
      setLoading(false);
    }
  };

  const onBuyKalshi = () => {
    setError(null);
    window.open(selectedMarket?.kalshi_url || "https://kalshi.com", "_blank");
  };

  return (
    <AnimatePresence>
      {buyPanelOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60" />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl rounded-lg border"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-heading font-bold text-[var(--accent-primary)]">Unified Buy Panel</h3>
              <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-100 p-1 rounded" aria-label="Close">✕</button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {buyPanelMode === "market" && selectedMarket && (
                  <div className="rounded-lg border p-5" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                    <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Prediction market</p>
                    <p className="font-heading font-bold text-[var(--text-primary)] text-sm line-clamp-2">{selectedMarket.title}</p>
                    <p className="font-mono text-[var(--accent-kalshi)] mt-2">{selectedMarket.probability.toFixed(0)}% YES</p>
                    <p className="text-[var(--text-secondary)] text-xs mt-2 mb-3">Market trading is on Kalshi. Use the link below to trade.</p>
                    <a
                      href={selectedMarket.kalshi_url || "https://kalshi.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 flex items-center justify-center gap-2"
                      style={{ background: "var(--accent-kalshi)", color: "var(--bg-base)", height: "36px" }}
                    >
                      Trade on Kalshi
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
                {buyPanelMode === "token" && selectedToken && (
                  <div className="rounded-lg border p-5" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                    <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Solana Token</p>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setSellMode(false)}
                        className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-colors duration-100 ${!sellMode ? "text-[var(--bg-base)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                        style={!sellMode ? { background: "var(--accent-bags)" } : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        onClick={() => setSellMode(true)}
                        className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-colors duration-100 ${sellMode ? "text-[var(--bg-base)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                        style={sellMode ? { background: "var(--accent-bags)" } : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        Sell
                      </button>
                    </div>
                    <p className="font-heading font-bold text-[var(--text-primary)]">${selectedToken.symbol}</p>
                    {selectedToken.price != null && (
                      <p className="font-mono text-[var(--accent-primary)] text-sm mt-1 tabular-nums">~${selectedToken.price.toFixed(4)} USD</p>
                    )}
                    <p className="font-mono text-[var(--accent-bags)] mt-2 text-sm tabular-nums">
                      Vol 24h: {selectedToken.volume24h?.toLocaleString() ?? "-"} SOL
                    </p>
                    {!sellMode ? (
                      <>
                        <div className="mt-3">
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">SOL amount (enter for each buy)</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            placeholder="0.01"
                            value={solAmount}
                            onChange={(e) => setSolAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg font-mono text-sm text-[var(--text-primary)] border transition-colors focus:border-[var(--border-active)] focus:outline-none"
                            style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                          />
                        </div>
                        <button
                          onClick={executeJupiterSwap}
                          disabled={loading}
                          className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ background: "var(--accent-bags)", color: "var(--bg-base)", height: "36px" }}
                        >
                          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Swapping…</> : `Buy ${selectedToken.symbol} (Jupiter)`}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="mt-3">
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">Amount of {selectedToken.symbol} to sell</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg font-mono text-sm text-[var(--text-primary)] border transition-colors focus:border-[var(--border-active)] focus:outline-none"
                            style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                          />
                        </div>
                        <button
                          onClick={executeJupiterSwap}
                          disabled={loading}
                          className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ background: "var(--accent-bags)", color: "var(--bg-base)", height: "36px" }}
                        >
                          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Selling…</> : `Sell ${selectedToken.symbol} → SOL`}
                        </button>
                      </>
                    )}
                    <div className="h-16 mt-2 rounded-lg overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
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
              {error && <p className="text-sm mt-3" style={{ color: "var(--red)" }}>{error}</p>}
              {success && <p className="text-sm mt-3" style={{ color: "var(--accent-bags)" }}>{success}</p>}
              <p className="text-[var(--text-secondary)] text-xs mt-4">Connect wallet. Markets: trade on Kalshi. Tokens: Jupiter.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
