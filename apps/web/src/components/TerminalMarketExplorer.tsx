"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, TrendingUp } from "lucide-react";
import type { MarketOutcome, MarketWithVelocity } from "@siren/shared";
import { useMarkets } from "@/hooks/useMarkets";
import { useSignals } from "@/hooks/useSignals";
import { useSirenStore } from "@/store/useSirenStore";
import { toSelectedMarket } from "@/lib/marketSelection";
import {
  inferMarketCategory,
  marketCategoryBadgeStyle,
  marketCategoryLabel,
  marketMatchesCategory,
  type MarketCategoryId,
  type MarketSourceFilter,
} from "@/lib/marketFeedFilters";
import { hapticLight } from "@/lib/haptics";

const LIVE_SIGNAL_WINDOW_MS = 30 * 60 * 1000;
const SOURCE_TABS: Array<{ id: MarketSourceFilter; label: string }> = [
  { id: "all", label: "All venues" },
  { id: "kalshi", label: "Kalshi" },
  { id: "polymarket", label: "Polymarket" },
];
const CATEGORY_TABS: Array<{ id: MarketCategoryId; label: string }> = [
  { id: "all", label: "Trending" },
  { id: "sports", label: "Sports" },
  { id: "politics", label: "Politics" },
  { id: "crypto", label: "Crypto" },
  { id: "finance", label: "Finance" },
  { id: "entertainment", label: "Entertainment" },
];

function formatCompactNumber(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCloseLabel(value?: number | null, multiOutcome = false): string {
  if (!value || !Number.isFinite(value)) {
    return multiOutcome ? "Ends by outcome" : "Open";
  }

  const timestampMs = value < 1_000_000_000_000 ? value * 1000 : value;
  return `Ends ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(timestampMs)}`;
}

function sourceTone(source?: string) {
  if (source === "polymarket") {
    return {
      label: "Polymarket",
      bg: "color-mix(in srgb, var(--polymarket) 12%, var(--bg-surface))",
      color: "var(--polymarket)",
      border: "color-mix(in srgb, var(--polymarket) 28%, transparent)",
    };
  }

  return {
    label: "Kalshi",
    bg: "color-mix(in srgb, var(--kalshi) 12%, var(--bg-surface))",
    color: "var(--kalshi)",
    border: "color-mix(in srgb, var(--kalshi) 28%, transparent)",
  };
}

function topOutcomes(market: MarketWithVelocity): MarketOutcome[] {
  if (!market.outcomes?.length) return [];
  return [...market.outcomes].sort((left, right) => (right.probability ?? 0) - (left.probability ?? 0)).slice(0, 2);
}

function MarketExplorerCard({
  market,
  onOpen,
}: {
  market: MarketWithVelocity;
  onOpen: (market: MarketWithVelocity) => void;
}) {
  const source = sourceTone(market.source);
  const category = inferMarketCategory(market);
  const multiOutcome = !!(market.outcomes && market.outcomes.length > 1);
  const outcomes = topOutcomes(market);
  const yesProbability = Math.min(100, Math.max(0, market.probability));
  const noProbability = Math.min(100, Math.max(0, 100 - yesProbability));

  return (
    <button
      type="button"
      onClick={() => onOpen(market)}
      className="group w-full rounded-[26px] border p-5 text-left transition-all duration-200 hover:border-[var(--border-active)] hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      style={{
        borderColor: "var(--border-subtle)",
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 7%, transparent), transparent 30%), linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 92%, transparent), var(--bg-base))",
        boxShadow: "0 18px 40px -32px rgba(0,0,0,0.9)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {category && (
          <span
            className="rounded-full px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ background: marketCategoryBadgeStyle(category).bg, color: marketCategoryBadgeStyle(category).color }}
          >
            {marketCategoryLabel(category)}
          </span>
        )}
        <span
          className="rounded-full border px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: source.bg, color: source.color, borderColor: source.border }}
        >
          {source.label}
        </span>
        {multiOutcome && (
          <span
            className="rounded-full border px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ background: "var(--bg-surface)", color: "var(--text-3)", borderColor: "var(--border-subtle)" }}
          >
            {market.outcomes?.length} outcomes
          </span>
        )}
      </div>

      <h3 className="mt-4 max-w-[24ch] font-heading text-[1.55rem] font-semibold leading-[1.04] tracking-[-0.05em]" style={{ color: "var(--text-1)" }}>
        {market.title}
      </h3>

      {multiOutcome ? (
        <div className="mt-5 space-y-3">
          {outcomes.map((outcome) => (
            <div
              key={outcome.ticker ?? outcome.label}
              className="flex items-center justify-between gap-4 rounded-[18px] border px-4 py-3"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <p className="min-w-0 truncate font-body text-sm" style={{ color: "var(--text-1)" }}>
                {outcome.label}
              </p>
              <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
                {outcome.probability.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[18px] border px-4 py-4" style={{ borderColor: "color-mix(in srgb, var(--up) 26%, transparent)", background: "color-mix(in srgb, var(--up) 6%, var(--bg-surface))" }}>
            <p className="font-body text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              Yes
            </p>
            <p className="mt-2 font-mono text-[1.4rem] font-semibold tabular-nums" style={{ color: "var(--up)" }}>
              {yesProbability.toFixed(0)}%
            </p>
          </div>
          <div className="rounded-[18px] border px-4 py-4" style={{ borderColor: "color-mix(in srgb, var(--down) 26%, transparent)", background: "color-mix(in srgb, var(--down) 6%, var(--bg-surface))" }}>
            <p className="font-body text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              No
            </p>
            <p className="mt-2 font-mono text-[1.4rem] font-semibold tabular-nums" style={{ color: "var(--down)" }}>
              {noProbability.toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[18px] border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            24h volume
          </p>
          <p className="mt-2 font-mono text-lg font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(market.volume_24h ?? market.volume) === "—" ? "—" : `$${formatCompactNumber(market.volume_24h ?? market.volume)}`}
          </p>
        </div>
        <div className="rounded-[18px] border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            {market.source === "polymarket" ? "Liquidity" : "Open interest"}
          </p>
          <p className="mt-2 font-mono text-lg font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(market.source === "polymarket" ? market.liquidity : market.open_interest)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
          {formatCloseLabel(market.close_time, multiOutcome)}
        </p>
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors group-hover:border-[var(--accent)]"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)", background: "var(--bg-surface)" }}
        >
          Open market
        </span>
      </div>
    </button>
  );
}

export function TerminalMarketExplorer() {
  const router = useRouter();
  const { data: markets = [], isLoading, isError, refetch } = useMarkets();
  const { signals } = useSignals();
  const { setSelectedMarket } = useSirenStore();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<MarketSourceFilter>("all");
  const [category, setCategory] = useState<MarketCategoryId>("all");

  const liveSignals = useMemo(
    () => signals.filter((signal) => Date.now() - Date.parse(signal.timestamp) <= LIVE_SIGNAL_WINDOW_MS),
    [signals],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return markets
      .filter((market) => (source === "all" ? true : market.source === source))
      .filter((market) => marketMatchesCategory(market, category))
      .filter((market) => {
        if (!normalizedQuery) return true;
        return (
          market.title.toLowerCase().includes(normalizedQuery) ||
          market.ticker.toLowerCase().includes(normalizedQuery) ||
          market.subtitle?.toLowerCase().includes(normalizedQuery) ||
          market.outcomes?.some((outcome) => outcome.label.toLowerCase().includes(normalizedQuery))
        );
      })
      .sort((left, right) => {
        const leftMoving = liveSignals.some((signal) => signal.marketId === (left.platform_id ?? left.ticker));
        const rightMoving = liveSignals.some((signal) => signal.marketId === (right.platform_id ?? right.ticker));
        if (leftMoving !== rightMoving) return rightMoving ? 1 : -1;
        const leftScore = (left.volume_24h ?? left.volume ?? 0) + (left.open_interest ?? 0);
        const rightScore = (right.volume_24h ?? right.volume ?? 0) + (right.open_interest ?? 0);
        return rightScore - leftScore;
      });
  }, [markets, source, category, query, liveSignals]);

  const openMarket = (market: MarketWithVelocity) => {
    hapticLight();
    setSelectedMarket(toSelectedMarket(market));
    router.push(`/market/${encodeURIComponent(market.ticker)}`);
  };

  return (
    <section className="mx-auto flex w-full max-w-[1640px] flex-col gap-6 px-3 py-4 md:px-5 md:py-6">
      <div className="rounded-[28px] border p-5 md:p-6" style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 94%, transparent), var(--bg-base))" }}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                Prediction markets
              </p>
              <h1 className="mt-3 font-heading text-[2.4rem] font-semibold leading-[0.95] tracking-[-0.06em]" style={{ color: "var(--text-1)" }}>
                Browse markets first. Open depth, execution, and risk on the next screen.
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                This is the explorer layer. Search the market, filter by venue or category, then open the dedicated Siren market page when you want route quality, sizing, and risk context.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[440px]">
              {[
                { label: "Tracked", value: markets.length.toLocaleString(), detail: "live market rows" },
                { label: "Moving", value: liveSignals.length.toLocaleString(), detail: "signals in the last 30m" },
                { label: "Venues", value: "2", detail: "Kalshi + Polymarket" },
              ].map((item) => (
                <div key={item.label} className="rounded-[20px] border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                  <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                    {item.label}
                  </p>
                  <p className="mt-2 font-heading text-2xl font-semibold" style={{ color: "var(--text-1)" }}>
                    {item.value}
                  </p>
                  <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div
              className="flex h-14 w-full items-center gap-3 rounded-[22px] border px-4 xl:max-w-[520px]"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-3)" }} />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search markets, tickers, or outcomes"
                className="w-full bg-transparent font-body text-sm outline-none placeholder:text-[var(--text-3)]"
                style={{ color: "var(--text-1)" }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {SOURCE_TABS.map((tab) => {
                const active = tab.id === source;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setSource(tab.id);
                    }}
                    className="rounded-full border px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                      background: active ? "color-mix(in srgb, var(--accent) 10%, var(--bg-surface))" : "var(--bg-surface)",
                      color: active ? "var(--accent)" : "var(--text-2)",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORY_TABS.map((tab) => {
              const active = tab.id === category;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setCategory(tab.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 font-body text-sm transition-colors"
                  style={{
                    borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                    background: active ? "color-mix(in srgb, var(--accent) 10%, var(--bg-surface))" : "var(--bg-surface)",
                    color: active ? "var(--text-1)" : "var(--text-2)",
                  }}
                >
                  {tab.id === "all" && <TrendingUp className="h-4 w-4" />}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[360px] rounded-[26px] border"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-[28px] border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-heading text-xl font-semibold" style={{ color: "var(--text-1)" }}>
            Market explorer is unavailable right now.
          </p>
          <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Siren could not refresh the live market feed. Retry and we’ll pull the latest Kalshi and Polymarket books again.
          </p>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              void refetch();
            }}
            className="mt-4 rounded-full border px-4 py-2 font-body text-sm font-semibold"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-surface))" }}
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[28px] border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-heading text-xl font-semibold" style={{ color: "var(--text-1)" }}>
            No markets match this view yet.
          </p>
          <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Clear the search or switch venue/category filters to widen the market set.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((market) => (
            <MarketExplorerCard key={`${market.source}-${market.platform_id ?? market.ticker}`} market={market} onOpen={openMarket} />
          ))}
        </div>
      )}
    </section>
  );
}
