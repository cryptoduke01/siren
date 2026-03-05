"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import type { SurfacedToken } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
      className="flex-shrink-0 rounded-[8px] border p-3 mb-4"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
    >
      <h3 className="font-heading font-semibold text-[10px] mb-2" style={{ letterSpacing: "0.1em", color: "var(--text-3)" }}>
        ACTIVITY
      </h3>
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
            className="font-body text-[11px] px-2 py-1 rounded-[4px] truncate max-w-[140px] transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
          >
            {m.title.slice(0, 24)}…
          </button>
        ))}
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
            className="font-body text-[11px] px-2 py-1 rounded-[4px] truncate max-w-[100px] transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ color: "var(--bags)", border: "1px solid var(--border-subtle)" }}
          >
            ${t.symbol}
          </button>
        ))}
      </div>
      <Link
        href="/trending"
        className="font-body text-[10px] mt-2 inline-block"
        style={{ color: "var(--text-3)" }}
        onClick={() => hapticLight()}
      >
        View trending →
      </Link>
    </div>
  );
}
