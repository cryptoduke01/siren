"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { useSirenStore } from "@/store/useSirenStore";
import type { SurfacedToken } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function fetchTrendingTokens(): Promise<SurfacedToken[]> {
  return fetch(`${API_URL}/api/tokens`, { credentials: "omit" })
    .then((r) => {
      if (!r.ok) throw new Error(`Tokens API error: ${r.status}`);
      return r.json();
    })
    .then((j) => j.data ?? []);
}

export default function TrendingPage() {
  const { setSelectedToken } = useSirenStore();

  const { data: tokens = [], isLoading, isError } = useQuery({
    queryKey: ["trending-tokens"],
    queryFn: fetchTrendingTokens,
    retry: 2,
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-siren-bg">
      <TopBar />
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <h1 className="font-heading font-bold text-2xl md:text-3xl text-siren-primary mb-2">Trending</h1>
        <p className="text-siren-text-secondary text-sm mb-6">
          Hot Solana tokens from DexScreener (refreshes every 60s).
        </p>
        {isError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            Failed to load tokens. Make sure the API is running on port 4000.
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-40 bg-siren-border/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tokens.map((t, i) => (
              <motion.div
                key={t.mint}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 hover:border-siren-bags/40 transition-colors cursor-pointer"
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
                <div className="flex items-center gap-3 mb-3">
                  {t.imageUrl && <img src={t.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />}
                  <div className="min-w-0">
                    <p className="font-heading font-semibold text-siren-text-primary truncate">${t.symbol}</p>
                    <p className="text-siren-text-secondary text-xs truncate">{t.name}</p>
                  </div>
                </div>
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
      </main>
    </div>
  );
}
