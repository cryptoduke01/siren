"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { useSirenStore } from "@/store/useSirenStore";
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
      className="p-1.5 rounded-lg text-siren-text-secondary hover:text-siren-primary hover:bg-white/5 transition-colors"
      title="Copy Contract Address"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-siren-bags" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function TokenSurface() {
  const { selectedMarket } = useSirenStore();
  const [launchPanelOpen, setLaunchPanelOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const searchQuery = searchInput.trim();
  const keywordsForApi = useMemo(() => (searchQuery ? [searchQuery] : selectedMarket?.keywords ?? []), [searchQuery, selectedMarket?.keywords]);

  const { data: tokens = [], isLoading, isError } = useQuery({
    queryKey: ["tokens", selectedMarket?.ticker, keywordsForApi.join(",")],
    queryFn: () => fetchTokens(selectedMarket?.ticker, undefined, keywordsForApi.length ? keywordsForApi : undefined),
    enabled: true,
    retry: 2,
    refetchInterval: searchQuery ? false : 60_000,
    staleTime: searchQuery ? 10_000 : 30_000,
  });

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
        <h2 className="font-heading font-semibold text-siren-text-primary text-xs uppercase tracking-wider">
          {selectedMarket ? `Tokens for: ${selectedMarket.title.slice(0, 50)}${selectedMarket.title.length > 50 ? "…" : ""}` : "Surfaced Tokens"}
        </h2>
        <button
          type="button"
          onClick={() => { hapticLight(); setLaunchPanelOpen(true); }}
          className="px-3 py-1.5 text-xs font-semibold bg-siren-bags text-siren-bg rounded-lg hover:opacity-90 transition-opacity"
        >
          Launch token
        </button>
      </div>
      {launchPanelOpen && <LaunchTokenPanel onClose={() => setLaunchPanelOpen(false)} />}
      <p className="text-siren-text-secondary/80 text-xs mb-3">Markets: DFlow. Tokens: DexScreener/Jupiter (Solana).</p>
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search any token by name, symbol, or contract address…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full max-w-sm px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-siren-text-primary text-sm placeholder:text-siren-text-secondary/60"
        />
        <p className="text-siren-text-secondary/70 text-xs mt-1">Searches DexScreener (Solana). Type and wait a moment for results.</p>
      </div>
      {isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 glass-card">
          <p>Failed to load tokens. Make sure the API is running on port 4000.</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTokens.map((t, i) => (
            <motion.div
              key={t.mint}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 hover:border-siren-bags/40 transition-all cursor-pointer"
              onClick={() =>
                setSelectedToken({
                  mint: t.mint,
                  name: t.name,
                  symbol: t.symbol,
                  price: t.price,
                  volume24h: t.volume24h,
                  ctMentions: t.ctMentions,
                })
              }
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  {t.imageUrl && <img src={t.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />}
                  <div className="min-w-0">
                    <p className="font-heading font-semibold text-siren-text-primary truncate">${t.symbol}</p>
                    <p className="text-siren-text-secondary text-xs truncate">{t.name}</p>
                  </div>
                </div>
                <CopyCAButton mint={t.mint} />
              </div>
              {t.price != null && (
                <div className="text-xs font-data text-siren-primary tabular-nums mb-2">~${t.price.toFixed(4)} USD</div>
              )}
              <div className="flex justify-between text-xs font-data tabular-nums">
                <span className="text-siren-text-secondary">24h Vol</span>
                <span className="text-siren-bags">{t.volume24h?.toLocaleString() ?? "-"} SOL</span>
              </div>
              <div className="flex justify-between text-xs font-data mt-1 tabular-nums">
                <span className="text-siren-text-secondary">CT mentions</span>
                <span className="text-siren-text-primary">{t.ctMentions ?? "-"}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedToken({
                    mint: t.mint,
                    name: t.name,
                    symbol: t.symbol,
                    price: t.price,
                    volume24h: t.volume24h,
                    ctMentions: t.ctMentions,
                  });
                }}
                className="mt-3 w-full py-2.5 bg-siren-bags text-siren-bg font-heading font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                Buy
              </button>
            </motion.div>
          ))}
        </div>
      )}
      {!isLoading && !isError && tokens.length === 0 && (
        <div className="py-8 px-6 rounded-xl border border-white/10 border-dashed bg-white/5 text-center">
          <p className="text-siren-text-secondary text-sm mb-3">
            {searchQuery ? "No tokens found for this search." : selectedMarket ? "No tokens found for this market." : "Select a market or search above."}
          </p>
          {selectedMarket && !searchQuery && (
            <p className="text-siren-text-secondary text-xs">Use “Launch token” above to create one.</p>
          )}
        </div>
      )}
      {!isLoading && !isError && tokens.length > 0 && filteredTokens.length === 0 && (
        <div className="py-6 px-4 rounded-xl border border-white/10 bg-white/5 text-center">
          <p className="text-siren-text-secondary text-sm">No tokens match your search. Try name, symbol, or contract address.</p>
        </div>
      )}
    </div>
  );
}
