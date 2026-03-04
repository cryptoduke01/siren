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
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <h1 className="font-heading font-bold text-2xl md:text-3xl mb-2" style={{ color: "var(--accent)" }}>
          Trending
        </h1>
        <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
          Hot Solana tokens from DexScreener (refreshes every 60s).
        </p>
        {isError ? (
          <div
            className="rounded-[6px] border p-4 text-sm"
            style={{ borderColor: "var(--down)", background: "var(--bg-surface)", color: "var(--down)" }}
          >
            Failed to load tokens.
          </div>
        ) : isLoading ? (
          <div className="token-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="skeleton-card" />
            ))}
          </div>
        ) : (
          <div className="token-grid">
            {tokens.map((t, i) => (
              <motion.div
                key={t.mint}
                initial={{ opacity: 0, transform: "translateY(6px)" }}
                animate={{ opacity: 1, transform: "translateY(0)" }}
                transition={{ duration: 0.18, delay: i * 0.04, ease: "easeOut" }}
                className="rounded-[8px] p-3.5 cursor-pointer transition-all duration-[100ms] ease hover:bg-[var(--bg-elevated)]"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderTop: "2px solid var(--border-subtle)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px var(--border-active)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
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
                <div className="flex items-center gap-2 mb-2">
                  {t.imageUrl && <img src={t.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />}
                  <p className="font-heading font-bold text-sm truncate" style={{ color: "var(--text-1)" }}>
                    ${t.symbol}
                  </p>
                </div>
                <p className="font-body text-[11px] truncate mb-2" style={{ color: "var(--text-2)" }}>
                  {t.name}
                </p>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-body font-medium text-[10px] uppercase" style={{ color: "var(--text-3)" }}>
                    24h Vol
                  </span>
                  <span className="font-mono text-xs tabular-nums">
                    <span style={{ color: "var(--text-1)" }}>{t.volume24h?.toLocaleString() ?? "-"}</span>
                    <span style={{ color: "var(--text-3)" }}> SOL</span>
                  </span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-body font-medium text-[10px] uppercase" style={{ color: "var(--text-3)" }}>
                    CT mentions
                  </span>
                  <span className="font-mono text-xs tabular-nums" style={{ color: "var(--text-1)" }}>
                    {t.ctMentions ?? "-"}
                  </span>
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
                  className="w-full h-8 rounded-[6px] font-heading font-bold text-xs uppercase transition-all duration-[80ms] ease hover:brightness-[1.08]"
                  style={{
                    background: "var(--bags)",
                    color: "var(--accent-text)",
                    letterSpacing: "0.06em",
                  }}
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
