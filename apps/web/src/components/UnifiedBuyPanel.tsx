"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { useSirenStore } from "@/store/useSirenStore";
import { ResultModal } from "./ResultModal";
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
  const { connected, publicKey, signTransaction } = useSirenWallet();
  const { connection } = useConnection();
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const { data: solPriceUsd = 0 } = useQuery({
    queryKey: ["sol-price"],
    queryFn: () => fetch(`${API_URL}/api/sol-price`, { credentials: "omit" }).then((r) => r.json()).then((j) => j.usd ?? 0),
    staleTime: 60_000,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{ type: "success" | "error"; title: string; message: string; txSignature?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [solAmount, setSolAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellMode, setSellMode] = useState(false);
  const [slippageBps, setSlippageBps] = useState(200);

  const { data: tokenBalance = 0 } = useQuery({
    queryKey: ["sell-token-balance", publicKey?.toBase58(), selectedToken?.mint, sellMode],
    queryFn: async () => {
      if (!publicKey || !selectedToken || !sellMode) return 0;
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: new PublicKey(selectedToken.mint),
      });
      const acc = accounts.value[0];
      const info = (acc?.account?.data as { parsed?: { info?: { tokenAmount?: { uiAmount: number } } } })?.parsed?.info;
      return info?.tokenAmount?.uiAmount ?? 0;
    },
    enabled: !!publicKey && !!selectedToken && sellMode,
    staleTime: 10_000,
  });

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
    setResultModal(null);
  };

  const executeSwap = async () => {
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
      let inputMint: string;
      let outputMint: string;
      let amount: string;

      let amountNum: number;

      if (isSell) {
        const amountStr = sellAmount?.trim() || "0";
        amountNum = parseFloat(amountStr);
        if (amountNum <= 0 || !Number.isFinite(amountNum)) {
          setError("Enter a valid token amount to sell.");
          setLoading(false);
          return;
        }
        const decimals = 6;
        amount = String(BigInt(Math.floor(amountNum * 10 ** decimals)));
        inputMint = selectedToken.mint;
        outputMint = NATIVE_SOL_MINT;
      } else {
        const amountStr = solAmount?.trim() || "";
        amountNum = parseFloat(amountStr);
        if (!amountStr || amountNum <= 0 || !Number.isFinite(amountNum)) {
          setError("Enter a valid SOL amount (e.g. 0.01).");
          setLoading(false);
          return;
        }
        amount = String(Math.floor(amountNum * LAMPORTS_PER_SOL));
        inputMint = NATIVE_SOL_MINT;
        outputMint = selectedToken.mint;
      }

      const res = await fetch(`${API_URL}/api/swap/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount,
          userPublicKey: publicKey.toBase58(),
          slippageBps,
          tryDflowFirst: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Swap failed");
      }
      const txB64 = data.transaction;
      if (!txB64) throw new Error("No transaction returned");
      const txBuf = Buffer.from(txB64, "base64");
      const tx = VersionedTransaction.deserialize(txBuf);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction(sig, "confirmed");

      // Track per-wallet volume and trades for Siren (local, in SOL terms)
      try {
        if (typeof window !== "undefined" && solPriceUsd > 0) {
          let volumeSol: number | null = null;
          let tokenAmountApprox: number | null = null;
          const tokenPriceUsd = selectedToken.price ?? null;

          if (isSell) {
            if (tokenPriceUsd != null && tokenPriceUsd > 0) {
              tokenAmountApprox = amountNum;
              const approxSolPerToken = tokenPriceUsd / solPriceUsd;
              volumeSol = amountNum * approxSolPerToken;
            }
          } else {
            volumeSol = amountNum;
            if (tokenPriceUsd != null && tokenPriceUsd > 0) {
              tokenAmountApprox = (amountNum * solPriceUsd) / tokenPriceUsd;
            }
          }
          if (volumeSol != null && Number.isFinite(volumeSol) && volumeSol > 0) {
            const key = `siren-volume-${publicKey.toBase58()}`;
            const raw = window.localStorage.getItem(key);
            let entries: Array<{ ts: number; mint: string; side: "buy" | "sell"; volumeSol: number }> = [];
            if (raw) {
              try {
                entries = JSON.parse(raw);
                if (!Array.isArray(entries)) entries = [];
              } catch {
                entries = [];
              }
            }
            entries.push({
              ts: Date.now(),
              mint: selectedToken.mint,
              side: isSell ? "sell" : "buy",
              volumeSol,
            });
            // Keep only the most recent 500 entries to bound storage
            if (entries.length > 500) {
              entries = entries.slice(entries.length - 500);
            }
            window.localStorage.setItem(key, JSON.stringify(entries));
          }

          // Trade log for PnL / detailed stats
          if (tokenAmountApprox != null && tokenAmountApprox > 0 && tokenPriceUsd != null && tokenPriceUsd > 0) {
            const tradesKey = `siren-trades-${publicKey.toBase58()}`;
            const rawTrades = window.localStorage.getItem(tradesKey);
            let trades: Array<{
              ts: number;
              mint: string;
              side: "buy" | "sell";
              solAmount: number;
              tokenAmount: number;
              priceUsd: number;
            }> = [];
            if (rawTrades) {
              try {
                trades = JSON.parse(rawTrades);
                if (!Array.isArray(trades)) trades = [];
              } catch {
                trades = [];
              }
            }
            trades.push({
              ts: Date.now(),
              mint: selectedToken.mint,
              side: isSell ? "sell" : "buy",
              solAmount: volumeSol ?? 0,
              tokenAmount: tokenAmountApprox,
              priceUsd: tokenPriceUsd,
            });
            if (trades.length > 1000) {
              trades = trades.slice(trades.length - 1000);
            }
            window.localStorage.setItem(tradesKey, JSON.stringify(trades));
          }
        }
      } catch {
        // ignore volume tracking errors
      }

      setSuccess(isSell ? `Sold! Tx: ${sig.slice(0, 8)}...` : `Swap successful! ${sig.slice(0, 8)}...`);
      if (isSell) setSellAmount("");
      queryClient.invalidateQueries({ queryKey: ["transactions", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["wallet-tokens", publicKey.toBase58()] });
      setResultModal({ type: "success", title: "Swap complete", message: isSell ? `Sold ${selectedToken.symbol}.` : `Swap successful.`, txSignature: sig });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap failed";
      const friendly = msg.includes("0x1771") || msg.toLowerCase().includes("slippage") ? "Price moved. Try a smaller amount." : msg;
      setError(friendly);
      setResultModal({ type: "error", title: "Swap failed", message: friendly });
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
          key="unified-buy-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60" />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-hidden flex flex-col rounded-2xl border shadow-xl"
            style={{
              background: "linear-gradient(165deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
              borderColor: "var(--border-subtle)",
              boxShadow: "0 0 0 1px var(--border-subtle), 0 20px 50px -15px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-4 md:px-6 py-3 border-b shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
              <h3 className="font-heading font-bold text-[var(--accent-primary)] text-base">Unified Buy Panel</h3>
              <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-2 -m-2 rounded-lg hover:bg-[var(--bg-elevated)]" aria-label="Close">✕</button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
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
                  <>
                  <div className="rounded-xl border p-4 md:p-5" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)" }}>
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
                    <p className="font-mono text-[var(--text-1)] mt-2 text-sm tabular-nums">
                      Vol 24h: {selectedToken.volume24h?.toLocaleString() ?? "-"} SOL
                      {selectedToken.volume24h != null && solPriceUsd > 0 && (
                        <span className="text-[var(--text-3)] ml-1">
                          (≈${(selectedToken.volume24h * solPriceUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                        MEV protected
                      </span>
                      <span className="text-[10px] text-[var(--text-3)]">Slippage:</span>
                      {[100, 200, 500].map((bps) => (
                        <button
                          key={bps}
                          type="button"
                          onClick={() => { hapticLight(); setSlippageBps(bps); }}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${slippageBps === bps ? "bg-[var(--accent)] text-[var(--accent-text)]" : "bg-[var(--bg-surface)] text-[var(--text-2)] hover:text-[var(--text-1)]"}`}
                        >
                          {(bps / 100).toFixed(1)}%
                        </button>
                      ))}
                    </div>
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
                          onClick={executeSwap}
                          disabled={loading}
                          className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ background: "var(--accent-bags)", color: "var(--bg-base)", height: "36px" }}
                        >
                          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Swapping…</> : `Buy ${selectedToken.symbol}`}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="mt-3">
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">Amount of {selectedToken.symbol} to sell</label>
                          <div className="flex gap-1.5 mb-2">
                            {([25, 50, 75, 100] as const).map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  hapticLight();
                                  const amt = tokenBalance > 0 ? (tokenBalance * pct) / 100 : 0;
                                  setSellAmount(amt > 0 ? amt.toString() : "");
                                }}
                                className="flex-1 py-1.5 rounded-md text-[11px] font-heading font-semibold transition-all duration-100"
                                style={{
                                  background: "var(--bg-surface)",
                                  color: "var(--text-2)",
                                  border: "1px solid var(--border-subtle)",
                                }}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder={tokenBalance > 0 ? tokenBalance.toLocaleString() : "0"}
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg font-mono text-sm text-[var(--text-primary)] border transition-colors focus:border-[var(--border-active)] focus:outline-none"
                            style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                          />
                        </div>
                        <button
                          onClick={executeSwap}
                          disabled={loading}
                          className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ background: "var(--accent-bags)", color: "var(--bg-base)", height: "36px" }}
                        >
                          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Selling…</> : `Sell ${selectedToken.symbol} → SOL`}
                        </button>
                      </>
                    )}
                    <div className="mt-3 md:mt-4 pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                      <p className="text-[10px] uppercase text-[var(--text-3)] mb-1">24h price sketch</p>
                      <div className="h-20 md:h-28 rounded-lg overflow-hidden" style={{ background: "var(--bg-surface)" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={MOCK_CHART_DATA}>
                            <defs>
                              <linearGradient id="priceGradPanel" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#00FF85" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#00FF85" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="v" stroke="#00FF85" strokeWidth={2} fill="url(#priceGradPanel)" />
                            <XAxis dataKey="t" tick={{ fontSize: 9 }} stroke="var(--text-3)" />
                            <YAxis hide domain={["dataMin", "dataMax"]} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <CopyCAButton mint={selectedToken.mint} />
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 flex flex-col" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)" }}>
                    <p className="text-[var(--text-secondary)] text-xs uppercase mb-3">Token info</p>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between">
                        <span className="text-[var(--text-3)]">Price (est.)</span>
                        <span className="font-mono text-[var(--accent-primary)] tabular-nums">
                          {selectedToken.price != null ? `$${selectedToken.price.toFixed(6)}` : "—"}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-[var(--text-3)]">24h volume</span>
                        <span className="font-mono text-[var(--accent-bags)] tabular-nums">
                          {selectedToken.volume24h != null ? `${selectedToken.volume24h.toLocaleString()} SOL` : "—"}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-[var(--text-3)]">Swap</span>
                        <span className="text-[var(--text-2)]">DFlow / Jupiter</span>
                      </p>
                    </div>
                    <p className="text-[10px] text-[var(--text-3)] mt-3 leading-relaxed">
                      Chart is illustrative. Execute swaps via Jupiter; confirm in your wallet.
                    </p>
                  </div>
                  </>
                )}
              </div>
              {!resultModal && error && <p className="text-sm mt-3" style={{ color: "var(--down)" }}>{error}</p>}
              {!resultModal && success && <p className="text-sm mt-3" style={{ color: "var(--accent-bags)" }}>{success}</p>}
              <p className="text-[var(--text-secondary)] text-[11px] mt-3 md:mt-4 leading-relaxed">Connect wallet. Markets: Kalshi. Swaps: DFlow (market tokens) or Jupiter (fallback). MEV protected.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
      {resultModal && (
        <ResultModal
          key="result-modal"
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          txSignature={resultModal.txSignature}
          onClose={() => setResultModal(null)}
        />
      )}
    </AnimatePresence>
  );
}
