"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Copy, Check, Info, ShoppingCart, RefreshCw } from "lucide-react";
import { useSirenStore } from "@/store/useSirenStore";
import { useToastStore } from "@/store/useToastStore";
import { LaunchTokenPanel } from "@/components/LaunchTokenPanel";
import { hapticLight } from "@/lib/haptics";
import type { SurfacedToken } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function fetchTokens(marketId?: string, categoryId?: string, keywords?: string[]): Promise<SurfacedToken[]> {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (categoryId) params.set("categoryId", categoryId);
  if (keywords?.length) params.set("keywords", keywords.join(","));
  return fetch(`${API_URL}/api/tokens?${params}`, { credentials: "omit" })
    .then((r) => {
      if (!r.ok) throw new Error(`Tokens API error: ${r.status}`);
      return r.json();
    })
    .then((j) => j.data ?? []);
}

function CopyCAButton({ mint }: { mint: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const isValidCA = mint && mint.length >= 32 && !mint.startsWith("mock");
  if (!isValidCA) return null;
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-100"
      title="Copy Contract Address"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[var(--accent-bags)]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function TokenSurface() {
  const { selectedMarket, setBuyPanelOpen, setDetailPanelOpen } = useSirenStore();
  const [launchPanelOpen, setLaunchPanelOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const searchQuery = searchInput.trim();
  const keywordsForApi = useMemo(() => (searchQuery ? [searchQuery] : selectedMarket?.keywords ?? []), [searchQuery, selectedMarket?.keywords]);

  const addToast = useToastStore((s) => s.addToast);
  const { data: tokens = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tokens", selectedMarket?.ticker, keywordsForApi.join(",")],
    queryFn: () => fetchTokens(selectedMarket?.ticker, undefined, keywordsForApi.length ? keywordsForApi : undefined),
    enabled: true,
    retry: 2,
    refetchInterval: searchQuery ? false : 60_000,
    staleTime: searchQuery ? 10_000 : 30_000,
  });

  useEffect(() => {
    if (isError && error) addToast("Unable to load tokens. Please try again in a moment.", "error");
  }, [isError, error, addToast]);

  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens;
    const q = searchQuery.toLowerCase();
    return tokens.filter(
      (t) =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.symbol && t.symbol.toLowerCase().includes(q)) ||
        (t.mint && t.mint.toLowerCase().includes(q))
    );
  }, [tokens, searchQuery]);

  const { setSelectedToken } = useSirenStore();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2
          className="font-heading font-semibold text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {selectedMarket ? `Tokens for: ${selectedMarket.title.slice(0, 50)}${selectedMarket.title.length > 50 ? "…" : ""}` : "Surfaced tokens"}
        </h2>
        <div className="flex items-center gap-2">
          {selectedMarket && (
            <>
              <button
                type="button"
                onClick={() => { hapticLight(); setBuyPanelOpen(true, "market"); }}
                className="px-3 py-2 text-xs font-heading font-bold uppercase tracking-[0.06em] rounded-md border transition-all duration-100 text-[var(--text-primary)] hover:border-[var(--border-active)] hover:bg-[var(--bg-hover)]"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
              >
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Trade market
                </span>
              </button>
              <button
                type="button"
                onClick={() => { hapticLight(); setDetailPanelOpen(true); }}
                className="p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-100"
                title="Market details"
              >
                <Info className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { hapticLight(); setLaunchPanelOpen(true); }}
            className="px-3 py-2 text-xs font-heading font-bold uppercase tracking-[0.06em] rounded-md border transition-all duration-100 text-[var(--text-primary)] hover:border-[var(--border-active)] hover:bg-[var(--bg-hover)]"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
          >
            Launch token
          </button>
        </div>
      </div>
      {launchPanelOpen && <LaunchTokenPanel onClose={() => setLaunchPanelOpen(false)} />}
      <p className="text-[var(--text-secondary)] text-xs mb-3">
        {selectedMarket
          ? "Tokens matched by keywords from the market title (DexScreener search). Click Trade market to buy YES/NO."
          : "New uprising tokens (DexScreener latest boosted)."}
      </p>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, symbol, or contract address"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full md:max-w-md px-4 py-3 rounded-lg font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] border transition-colors duration-100 focus:border-[var(--border-active)] focus:outline-none"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
        />
        <p className="text-[var(--text-tertiary)] text-xs mt-1.5">DexScreener (Solana). Results appear as you type.</p>
      </div>
      {isError ? (
        <div className="rounded-lg border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <p className="text-[var(--text-secondary)] text-sm mb-3">Unable to load tokens at the moment.</p>
          <button
            type="button"
            onClick={() => { hapticLight(); refetch(); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-heading font-semibold border"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 rounded-lg skeleton"
              style={{ background: "var(--bg-surface)" }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTokens.map((t, i) => {
            const velocityColor = selectedMarket?.velocity_1h != null
              ? selectedMarket.velocity_1h > 0
                ? "var(--green)"
                : "var(--red)"
              : "var(--border)";
            return (
              <motion.div
                key={t.mint}
                initial={{ opacity: 0, transform: "translateY(4px)" }}
                animate={{ opacity: 1, transform: "translateY(0)" }}
                transition={{ duration: 0.2, delay: i * 0.05, ease: "easeOut" }}
                className="rounded-lg border-t-2 border p-4 pt-4 transition-all duration-[120ms] ease-in-out cursor-pointer hover:border-[var(--border-active)]"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                  borderTopColor: velocityColor,
                  boxShadow: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-active)";
                  e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,255,133,0.08), 0 4px 24px rgba(0,255,133,0.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                onClick={() => {
                  hapticLight();
                  setSelectedToken({
                    mint: t.mint,
                    name: t.name,
                    symbol: t.symbol,
                    price: t.price,
                    volume24h: t.volume24h,
                    ctMentions: t.ctMentions,
                  });
                }}
              >
                {selectedMarket && (
                  <div
                    className="inline-block px-2 py-0.5 rounded font-mono text-[10px] tabular-nums mb-2"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    Market: {selectedMarket.probability.toFixed(0)}% YES
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {t.imageUrl && <img src={t.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />}
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-[var(--text-primary)] truncate">${t.symbol}</p>
                      <p className="text-[var(--text-secondary)] text-xs truncate font-body">{t.name}</p>
                    </div>
                  </div>
                  <CopyCAButton mint={t.mint} />
                </div>
                {t.price != null && (
                  <div className="text-xs font-mono text-[var(--text-primary)] tabular-nums mb-2">~${t.price.toFixed(4)} USD</div>
                )}
                <div className="flex justify-between text-xs font-mono tabular-nums mb-1">
                  <span className="text-[var(--text-secondary)]">24h Vol</span>
                  <span className="text-[var(--accent-bags)]">{t.volume24h?.toLocaleString() ?? "-"} SOL</span>
                </div>
                <div className="flex justify-between text-xs font-mono tabular-nums mb-3">
                  <span className="text-[var(--text-secondary)]">CT mentions</span>
                  <span className="text-[var(--text-primary)]">{t.ctMentions ?? "-"}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticLight();
                    setSelectedToken({
                      mint: t.mint,
                      name: t.name,
                      symbol: t.symbol,
                      price: t.price,
                      volume24h: t.volume24h,
                      ctMentions: t.ctMentions,
                    });
                  }}
                  className="w-full py-2 rounded-md font-heading font-semibold text-xs uppercase tracking-[0.06em] transition-all duration-100 border hover:border-[var(--border-active)]"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", borderColor: "var(--border)", height: "32px" }}
                >
                  Buy
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
      {!isLoading && !isError && tokens.length === 0 && (
        <div className="py-8 px-6 rounded-lg border border-dashed text-center" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <p className="text-[var(--text-secondary)] text-sm mb-3">
            {searchQuery ? "No tokens found for this search." : selectedMarket ? "No tokens found for this market." : "Select a market or search above."}
          </p>
          {selectedMarket && !searchQuery && (
            <p className="text-[var(--text-secondary)] text-xs">Use &quot;Launch token&quot; above to create one.</p>
          )}
        </div>
      )}
      {!isLoading && !isError && tokens.length > 0 && filteredTokens.length === 0 && (
        <div className="py-6 px-4 rounded-lg text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-[var(--text-secondary)] text-sm">No tokens match your search. Try name, symbol, or contract address.</p>
        </div>
      )}
    </div>
  );
}
