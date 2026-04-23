"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import { StarButton } from "@/components/StarButton";
import { hapticLight } from "@/lib/haptics";
import { toSelectedMarket } from "@/lib/marketSelection";

export default function WatchlistPage() {
  const router = useRouter();
  const { starredMarketTickers } = useWatchlistStore();
  const { data: markets = [] } = useMarkets();
  const { setSelectedMarket } = useSirenStore();

  const starredMarkets = markets.filter((m) => starredMarketTickers.includes(m.ticker));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <h1 className="font-heading font-bold text-2xl md:text-3xl mb-2" style={{ color: "var(--accent)" }}>
          Watchlist
        </h1>
        <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
          Starred prediction markets. Click to open execution context on the terminal.
        </p>

        {starredMarkets.length === 0 ? (
          <div
            className="rounded-[8px] border p-8 text-center"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
          >
            <p className="font-body" style={{ color: "var(--text-2)" }}>
              No starred markets yet. Open the terminal and star events you track.
            </p>
            <Link
              href="/terminal"
              className="inline-block mt-4 font-body font-medium text-sm px-4 py-2 rounded-[6px] transition-colors hover:bg-[var(--bg-elevated)]"
              style={{ color: "var(--accent)" }}
              onClick={() => hapticLight()}
            >
              Go to Terminal
            </Link>
          </div>
        ) : (
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
                    setSelectedMarket(toSelectedMarket(m));
                    router.push("/terminal");
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
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
