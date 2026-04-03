"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { useSirenStore } from "@/store/useSirenStore";
import { StarButton } from "@/components/StarButton";
import { API_URL } from "@/lib/apiUrl";

interface TrendingToken {
  mint: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  priceUsd?: number;
  volume24h?: number;
  marketCap?: number;
  liquidity?: number;
  dexUrl?: string;
}

function formatCompact(value?: number, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: digits }).format(value);
}

function formatPrice(price?: number): string {
  if (price == null || !Number.isFinite(price)) return "—";
  if (price < 0.001) return `$${price.toExponential(2)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

async function fetchTrending(): Promise<TrendingToken[]> {
  const res = await fetch(`${API_URL}/api/trending`, { credentials: "omit" });
  if (!res.ok) throw new Error(`Trending API error: ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as TrendingToken[];
}

export default function TrendingPage() {
  const { setSelectedToken } = useSirenStore();
  const { data: tokens = [], isLoading, isError } = useQuery({
    queryKey: ["trending-tokens-real"],
    queryFn: fetchTrending,
    retry: 2,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <h1 className="font-heading font-bold text-2xl md:text-3xl mb-1" style={{ color: "var(--accent)" }}>
          Trending
        </h1>
        <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
          Top Solana tokens right now via DexScreener.
        </p>

        {isError ? (
          <div className="rounded-lg border p-4 text-sm"
            style={{ borderColor: "var(--down)", background: "var(--bg-surface)", color: "var(--down)" }}>
            Failed to load trending tokens.
          </div>
        ) : isLoading ? (
          <div className="token-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-card" />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-center font-body text-sm py-12" style={{ color: "var(--text-3)" }}>
            No trending tokens available right now.
          </p>
        ) : (
          <div className="token-grid">
            {tokens.map((t, i) => (
              <motion.div
                key={t.mint}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
                className="group rounded-xl p-4 cursor-pointer transition-all hover:ring-1 hover:ring-[var(--accent)]/20"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                onClick={() =>
                  setSelectedToken({
                    mint: t.mint,
                    name: t.name,
                    symbol: t.symbol,
                    price: t.priceUsd,
                    volume24h: t.volume24h,
                    liquidityUsd: t.liquidity,
                    fdvUsd: t.marketCap,
                  })
                }
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
                        style={{ background: "var(--bg-elevated)" }}>
                        <span className="font-heading text-xs font-bold" style={{ color: "var(--accent)" }}>
                          {t.symbol.slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-sm truncate" style={{ color: "var(--text-1)" }}>
                        ${t.symbol}
                      </p>
                      <p className="font-body text-[11px] truncate" style={{ color: "var(--text-3)" }}>
                        {t.name}
                      </p>
                    </div>
                  </div>
                  <StarButton type="token" id={t.mint} />
                </div>

                {/* Price */}
                <p className="font-mono text-lg font-bold tabular-nums mb-3" style={{ color: "var(--text-1)" }}>
                  {formatPrice(t.priceUsd)}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg px-2.5 py-1.5" style={{ background: "var(--bg-base)" }}>
                    <p className="font-body text-[9px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Volume 24h</p>
                    <p className="font-mono text-xs font-medium" style={{ color: "var(--text-1)" }}>${formatCompact(t.volume24h)}</p>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5" style={{ background: "var(--bg-base)" }}>
                    <p className="font-body text-[9px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Mkt Cap</p>
                    <p className="font-mono text-xs font-medium" style={{ color: "var(--text-1)" }}>${formatCompact(t.marketCap)}</p>
                  </div>
                </div>

                <div className="rounded-lg px-2.5 py-1.5 mb-3" style={{ background: "var(--bg-base)" }}>
                  <p className="font-body text-[9px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Liquidity</p>
                  <p className="font-mono text-xs font-medium" style={{ color: "var(--text-1)" }}>${formatCompact(t.liquidity)}</p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedToken({
                      mint: t.mint,
                      name: t.name,
                      symbol: t.symbol,
                      price: t.priceUsd,
                      volume24h: t.volume24h,
                      liquidityUsd: t.liquidity,
                      fdvUsd: t.marketCap,
                    });
                  }}
                  className="w-full rounded-lg py-2 font-heading text-xs font-bold uppercase tracking-wide transition-all hover:brightness-110"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  Trade
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
