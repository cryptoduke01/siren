"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import type { SurfacedToken } from "@siren/shared";
import { toSelectedMarket } from "@/lib/marketSelection";
import { API_URL } from "@/lib/apiUrl";

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
              setSelectedMarket(toSelectedMarket(m));
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
                liquidityUsd: t.liquidityUsd,
                fdvUsd: t.fdvUsd,
                holders: t.holders,
                bondingCurveStatus: t.bondingCurveStatus,
                rugcheckScore: t.rugcheckScore,
                safe: t.safe,
                ctMentions: t.ctMentions,
              });
            }}
            className="font-body text-[11px] px-3 py-2 rounded-[6px] truncate max-w-[120px] transition-all duration-[120ms] hover:bg-[var(--bg-elevated)] hover:border-[var(--accent)]"
            style={{ color: "var(--accent)", border: "1px solid var(--border-subtle)" }}
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
