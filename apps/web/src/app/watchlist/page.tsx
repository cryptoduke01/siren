"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { MarketWithVelocity } from "@siren/shared";
import { TopBar } from "@/components/TopBar";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import { StarButton } from "@/components/StarButton";
import { hapticLight } from "@/lib/haptics";
import { toSelectedMarket } from "@/lib/marketSelection";
import { API_URL } from "@/lib/apiUrl";

type WatchlistCardMarket = {
  ticker: string;
  title: string;
  probability: number;
  source?: string;
  subtitle?: string;
  close_time?: number;
  selectedOutcomeLabel?: string;
  outcomeCount?: number;
  liveMarket?: MarketWithVelocity;
};

function formatWatchlistClose(value?: number): string | null {
  if (!value || !Number.isFinite(value)) return null;
  const timestampMs = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(timestampMs);
}

function venueLabel(source?: string): string {
  return source === "polymarket" ? "Polymarket" : "Kalshi";
}

function isBinaryOutcomeLabel(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "yes" || normalized === "no";
}

export default function WatchlistPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { starredMarketTickers, starredMarketsByTicker, hasHydrated } = useWatchlistStore();
  const { data: markets = [] } = useMarkets();
  const { setSelectedMarket } = useSirenStore();

  const starredMarkets = useMemo<WatchlistCardMarket[]>(() => {
    const liveByTicker = new Map(markets.map((market) => [market.ticker, market]));
    return starredMarketTickers.map((ticker) => {
      const liveMarket = liveByTicker.get(ticker);
      if (liveMarket) {
        return {
          ticker: liveMarket.ticker,
          title: liveMarket.title,
          probability: liveMarket.probability,
          source: liveMarket.source,
          subtitle: liveMarket.subtitle,
          close_time: liveMarket.close_time,
          selectedOutcomeLabel: liveMarket.selected_outcome_label,
          outcomeCount: liveMarket.outcomes?.length ?? liveMarket.outcome_count,
          liveMarket,
        };
      }
      const snapshot = starredMarketsByTicker[ticker];
      return {
        ticker,
        title: snapshot?.title || ticker,
        probability: snapshot?.probability ?? 0,
        source: snapshot?.source,
        subtitle: snapshot?.subtitle,
        close_time: snapshot?.closeTime,
        selectedOutcomeLabel: snapshot?.selectedOutcomeLabel,
        outcomeCount: snapshot?.outcomeCount,
      };
    });
  }, [markets, starredMarketTickers, starredMarketsByTicker]);

  const openMarket = async (market: WatchlistCardMarket) => {
    hapticLight();
    if (market.liveMarket) {
      setSelectedMarket(toSelectedMarket(market.liveMarket));
      router.push("/terminal");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/markets/${encodeURIComponent(market.ticker)}`, { credentials: "omit" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.data) {
        const fetchedMarket = payload.data as MarketWithVelocity;
        queryClient.setQueryData<MarketWithVelocity[]>(["markets"], (previous = []) => {
          if (previous.some((item) => item.ticker === fetchedMarket.ticker)) return previous;
          return [fetchedMarket, ...previous];
        });
        setSelectedMarket(toSelectedMarket(fetchedMarket));
        router.push("/terminal");
        return;
      }
    } catch {
      // Fall through to the market route so the user does not hit a dead click.
    }

    router.push(`/market/${encodeURIComponent(market.ticker)}`);
  };

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

        {!hasHydrated ? (
          <div
            className="rounded-[18px] border p-8 text-center"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
          >
            <p className="font-body" style={{ color: "var(--text-2)" }}>
              Loading your watchlist…
            </p>
          </div>
        ) : starredMarkets.length === 0 ? (
          <div
            className="rounded-[18px] border p-8 text-center"
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {starredMarkets.map((m) => (
                <motion.div
                  key={m.ticker}
                  initial={{ opacity: 0, translateY: 6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  className="relative cursor-pointer rounded-[20px] border p-4 transition-all duration-[120ms] ease hover:border-[var(--border-active)] hover:bg-[var(--bg-elevated)]"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                  onClick={() => void openMarket(m)}
                >
                  {(() => {
                    const selectedOutcome = m.selectedOutcomeLabel?.trim();
                    const hasSpecificOutcome = !!selectedOutcome && !isBinaryOutcomeLabel(selectedOutcome);
                    const detailLine = hasSpecificOutcome
                      ? `Tracking outcome: ${selectedOutcome}`
                      : m.outcomeCount && m.outcomeCount > 2
                        ? `${m.outcomeCount} possible outcomes`
                        : m.subtitle || (m.outcomeCount === 2 ? "Binary market" : "Saved market");

                    return (
                      <>
                  <div className="absolute top-2 right-2">
                    <StarButton
                      type="market"
                      id={m.ticker}
                      marketSnapshot={{
                        ticker: m.ticker,
                        title: m.title,
                        probability: m.probability,
                        source: m.source,
                        subtitle: m.subtitle,
                        closeTime: m.close_time,
                        selectedOutcomeLabel: m.selectedOutcomeLabel,
                        outcomeCount: m.outcomeCount,
                      }}
                    />
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
                    <span
                      className="rounded-full border px-2.5 py-1 font-sub text-[10px] uppercase tracking-[0.14em]"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-3)" }}
                    >
                      {venueLabel(m.source)}
                    </span>
                    {formatWatchlistClose(m.close_time) && (
                      <span
                        className="rounded-full border px-2.5 py-1 font-sub text-[10px] uppercase tracking-[0.14em]"
                        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-3)" }}
                      >
                        Closes {formatWatchlistClose(m.close_time)}
                      </span>
                    )}
                  </div>
                  <p className="font-heading font-semibold text-sm line-clamp-2 pr-8" style={{ color: "var(--text-1)" }}>
                    {m.title}
                  </p>
                  <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                    {detailLine}
                  </p>
                  <p className="mt-3 font-mono text-xs" style={{ color: "var(--accent)" }}>
                    Current price {m.probability.toFixed(0)}%
                  </p>
                  {m.liveMarket ? (
                    <p className="mt-3 font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
                      Live in current market feed
                    </p>
                  ) : (
                    <p className="mt-3 font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
                      Saved from your watchlist snapshot. Tap to refresh live market data.
                    </p>
                  )}
                      </>
                    );
                  })()}
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
