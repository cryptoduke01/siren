"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import { StarButton } from "@/components/StarButton";
import { hapticLight } from "@/lib/haptics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchTokenInfo(
  mint: string
): Promise<{
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  priceUsd?: number;
  riskScore?: number;
  riskLabel?: "low" | "moderate" | "high" | "critical";
  riskReasons?: string[];
  riskBlocked?: boolean;
} | null> {
  const res = await fetch(`${API_URL}/api/token-info?mint=${encodeURIComponent(mint)}`, { credentials: "omit" });
  if (!res.ok) return null;
  const j = await res.json();
  return j.data ?? null;
}

export default function WatchlistPage() {
  const router = useRouter();
  const { starredMarketTickers, starredTokenMints } = useWatchlistStore();
  const { data: markets = [] } = useMarkets();
  const { setSelectedMarket, setSelectedToken } = useSirenStore();

  const starredMarkets = markets.filter((m) => starredMarketTickers.includes(m.ticker));

  const tokenQueries = useQuery({
    queryKey: ["watchlist-tokens", starredTokenMints],
    queryFn: async () => {
      const results = await Promise.all(starredTokenMints.map((mint) => fetchTokenInfo(mint)));
      return starredTokenMints.map((mint, i) => ({ mint, info: results[i] ?? null }));
    },
    enabled: starredTokenMints.length > 0,
  });

  const tokenList = tokenQueries.data ?? [];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <h1 className="font-heading font-bold text-2xl md:text-3xl mb-2" style={{ color: "var(--accent)" }}>
          Watchlist
        </h1>
        <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
          Starred markets and tokens. Click to open on the terminal.
        </p>

        {starredMarkets.length === 0 && starredTokenMints.length === 0 ? (
          <div
            className="rounded-[8px] border p-8 text-center"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
          >
            <p className="font-body" style={{ color: "var(--text-2)" }}>
              No starred items yet. Star markets and tokens from the Terminal or Trending.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 font-body font-medium text-sm px-4 py-2 rounded-[6px] transition-colors hover:bg-[var(--bg-elevated)]"
              style={{ color: "var(--accent)" }}
              onClick={() => hapticLight()}
            >
              Go to Terminal
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {starredMarkets.length > 0 && (
              <section>
                <h2 className="font-heading font-semibold text-xs uppercase mb-3" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>
                  Markets
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {starredMarkets.map((m) => (
                    <motion.div
                      key={m.ticker}
                      initial={{ opacity: 0, translateY: 6 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      className="rounded-[6px] border p-3 cursor-pointer transition-all duration-[120ms] ease hover:border-[var(--border-active)] hover:bg-[var(--bg-elevated)] relative"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                      onClick={() => {
                        hapticLight();
                        const keywords = m.title
                          .toLowerCase()
                          .replace(/[^\w\s]/g, " ")
                          .split(/\s+/)
                          .filter((w) => w.length >= 2)
                          .slice(0, 4);
                        setSelectedMarket({
                          ticker: m.ticker,
                          title: m.title,
                          probability: m.probability,
                          velocity_1h: m.velocity_1h,
                          volume: m.volume,
                          open_interest: m.open_interest,
                          event_ticker: m.event_ticker,
                          series_ticker: m.series_ticker,
                          subtitle: m.subtitle,
                          keywords,
                          yes_mint: m.yes_mint,
                          no_mint: m.no_mint,
                          kalshi_url: m.kalshi_url,
                        });
                        router.push("/");
                      }}
                    >
                      <div className="absolute top-2 right-2">
                        <StarButton type="market" id={m.ticker} />
                      </div>
                      <p className="font-heading font-semibold text-sm line-clamp-2 pr-8" style={{ color: "var(--text-1)" }}>
                        {m.title}
                      </p>
                      <p className="font-mono text-xs mt-1" style={{ color: "var(--accent)" }}>
                        {m.probability.toFixed(0)}% YES
                      </p>
                      <Link
                        href={`/market/${m.ticker}`}
                        className="font-body text-[11px] mt-1 block"
                        style={{ color: "var(--text-3)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Share
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {starredTokenMints.length > 0 && (
              <section>
                <h2 className="font-heading font-semibold text-xs uppercase mb-3" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>
                  Tokens
                </h2>
                <div className="token-grid">
                  {tokenList.map(({ mint, info }, i) => (
                    <motion.div
                      key={mint}
                      initial={{ opacity: 0, translateY: 6 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-[10px] p-3 cursor-pointer transition-all duration-[100ms] ease hover:bg-[var(--bg-elevated)] relative border"
                      style={{
                        background: "var(--bg-surface)",
                        borderColor: "var(--border-subtle)",
                      }}
                      onClick={() => {
                        hapticLight();
                        setSelectedToken({
                          mint,
                          name: info?.name ?? "Unknown",
                          symbol: info?.symbol ?? "???",
                          price: info?.priceUsd,
                          volume24h: undefined,
                          ctMentions: undefined,
                          riskScore: info?.riskScore,
                          riskLabel: info?.riskLabel,
                          riskReasons: info?.riskReasons,
                          riskBlocked: info?.riskBlocked,
                        });
                        router.push("/");
                      }}
                    >
                      <div className="absolute top-2 right-2">
                        <StarButton type="token" id={mint} />
                      </div>
                      <div className="flex items-center gap-2 mb-2 pr-6">
                        {info?.imageUrl && (
                          <img src={info.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                        )}
                        <p className="font-heading font-bold text-sm truncate" style={{ color: "var(--text-1)" }}>
                          {info?.symbol ?? mint.slice(0, 8) + "…"}
                        </p>
                      </div>
                      {(info?.riskScore ?? 0) >= 60 && (
                        <p className="font-body text-[10px] mb-2" style={{ color: "var(--down)" }}>
                          Risk trade analysed
                        </p>
                      )}
                      <p className="font-body text-[11px] truncate" style={{ color: "var(--text-2)" }}>
                        {info?.name ?? mint}
                      </p>
                      <Link
                        href={`/token/${mint}`}
                        className="font-body text-[11px] mt-1 block"
                        style={{ color: "var(--text-3)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Share
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
