"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import type { SurfacedToken } from "@siren/shared";

import { API_URL } from "@/lib/apiUrl";

const MARKET_KEYWORDS = ["trump", "fed", "rates", "cpi", "inflation", "sec", "bitcoin", "btc", "election", "world", "cup", "georgia", "purdue", "uae", "icc", "t20", "sol", "eth", "jpow", "pepe", "bonk"];
const STOP_WORDS = new Set(["will", "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "way", "who", "any", "did", "let", "put", "say", "she", "too", "use", "from", "than", "that", "this", "with", "what", "when", "where", "which"]);

function extractKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  const fromKnown = MARKET_KEYWORDS.filter((kw) => lower.includes(kw)).slice(0, 2);
  const words = lower.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const seen = new Set(fromKnown);
  const out = [...fromKnown];
  for (const w of words) {
    if (!seen.has(w) && out.length < 4) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

function fetchTrending(): Promise<SurfacedToken[]> {
  return fetch(`${API_URL}/api/tokens`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : { data: [] }))
    .then((j) => j.data ?? [])
    .catch(() => []);
}

export function ActivityFeed() {
  const { data: markets = [] } = useMarkets();
  const { data: trending = [] } = useQuery({ queryKey: ["activity-trending"], queryFn: fetchTrending, staleTime: 60_000 });
  const { setSelectedMarket, setSelectedToken } = useSirenStore();

  const newMarkets = markets.slice(0, 3);
  const hotTokens = trending.slice(0, 4);

  if (newMarkets.length === 0 && hotTokens.length === 0) return null;

  return (
    <div
      className="flex-shrink-0 rounded-[10px] border p-5 mb-6"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
    >
      <div className="mb-3">
        <h3 className="font-heading font-semibold text-[11px] mb-1" style={{ letterSpacing: "0.12em", color: "var(--text-3)" }}>
          WHAT&apos;S HAPPENING
        </h3>
        <p className="font-body text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Fresh prediction markets and trending tokens. Click to explore.
        </p>
      </div>
      {newMarkets.length > 0 && (
        <div className="mb-4">
          <p className="font-body text-[10px] uppercase mb-2" style={{ color: "var(--text-3)", letterSpacing: "0.08em" }}>
            New markets
          </p>
          <div className="flex flex-wrap gap-2">
        {newMarkets.map((m) => (
          <button
            key={m.ticker}
            type="button"
            onClick={() => {
              hapticLight();
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
                keywords: extractKeywords(m.title),
                yes_mint: m.yes_mint,
                no_mint: m.no_mint,
                kalshi_url: m.kalshi_url,
              });
            }}
            className="font-body text-[11px] px-3 py-2 rounded-[6px] truncate max-w-[160px] transition-all duration-[120ms] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-active)]"
            style={{ color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
          >
            {m.title.slice(0, 28)}{m.title.length > 28 ? "…" : ""}
          </button>
        ))}
          </div>
        </div>
      )}
      {hotTokens.length > 0 && (
        <div>
          <p className="font-body text-[10px] uppercase mb-2" style={{ color: "var(--text-3)", letterSpacing: "0.08em" }}>
            Trending tokens
          </p>
          <div className="flex flex-wrap gap-2">
        {hotTokens.map((t) => (
          <button
            key={t.mint}
            type="button"
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
            className="font-body text-[11px] px-3 py-2 rounded-[6px] truncate max-w-[120px] transition-all duration-[120ms] hover:bg-[var(--bg-elevated)] hover:border-[var(--bags)]"
            style={{ color: "var(--bags)", border: "1px solid var(--border-subtle)" }}
          >
            ${t.symbol}
          </button>
        ))}
          </div>
        </div>
      )}
      <Link
        href="/trending"
        className="font-body text-[11px] mt-4 inline-block font-medium transition-colors hover:text-[var(--accent)]"
        style={{ color: "var(--text-2)" }}
        onClick={() => hapticLight()}
      >
        View all trending →
      </Link>
    </div>
  );
}
