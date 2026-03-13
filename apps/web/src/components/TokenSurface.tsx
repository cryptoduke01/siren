"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useSirenStore } from "@/store/useSirenStore";
import { useToastStore } from "@/store/useToastStore";
import { LaunchTokenPanel } from "@/components/LaunchTokenPanel";
import { StarButton } from "./StarButton";
import { TokenAlertButton } from "./AlertButton";
import { MarketAlertButton } from "./AlertButton";
import { MiniSparkline } from "./MiniSparkline";
import { LaunchpadBadge } from "./LaunchpadBadge";
import { hapticLight } from "@/lib/haptics";
import type { SurfacedToken } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function fetchTokens(marketId?: string, categoryId?: string, keywords?: string[]): Promise<SurfacedToken[]> {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (categoryId) params.set("categoryId", categoryId);
  if (keywords?.length) params.set("keywords", keywords.join(","));
  return fetch(`${API_URL}/api/tokens?${params}`, { credentials: "omit" })
    .then((r) => {
      if (!r.ok) throw new Error(`Tokens API error: ${r.status}`);
      return r.json();
    })
    .then((j) => j.data ?? []);
}

function CopyCAButton({ mint }: { mint: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const isValidCA = mint && mint.length >= 32 && !mint.startsWith("mock");
  if (!isValidCA) return null;
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-[4px] transition-colors duration-100 hover:bg-[var(--bg-hover)]"
      style={{ color: "var(--text-2)" }}
      title="Copy Contract Address"
    >
      {copied ? <Check className="w-3.5 h-3.5" style={{ color: "var(--bags)" }} /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function getTokenCardTopBorder(token: SurfacedToken): string {
  const ct = token.ctMentions ?? 0;
  const vol = token.volume24h ?? 0;
  if (ct > 10) return "var(--bags)";
  if (vol > 50) return "var(--kalshi)";
  return "var(--border-subtle)";
}

export function TokenSurface() {
  const { selectedMarket, setBuyPanelOpen, setDetailPanelOpen } = useSirenStore();
  const { publicKey } = useSirenWallet();
  const [launchPanelOpen, setLaunchPanelOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [bagsLaunches, setBagsLaunches] = useState<string[]>([]);

  const searchQuery = searchInput.trim();
  const keywordsForApi = useMemo(() => (searchQuery ? [searchQuery] : selectedMarket?.keywords ?? []), [searchQuery, selectedMarket?.keywords]);

  const addToast = useToastStore((s) => s.addToast);
  const { data: solPriceUsd = 0 } = useQuery({
    queryKey: ["sol-price"],
    queryFn: () => fetch(`${API_URL}/api/sol-price`, { credentials: "omit" }).then((r) => r.json()).then((j) => j.usd ?? 0),
    staleTime: 60_000,
  });
  const { data: tokens = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tokens", selectedMarket?.ticker, keywordsForApi.join(",")],
    queryFn: () => fetchTokens(selectedMarket?.ticker, undefined, keywordsForApi.length ? keywordsForApi : undefined),
    enabled: true,
    retry: 2,
    refetchInterval: searchQuery ? false : 60_000,
    staleTime: searchQuery ? 10_000 : 30_000,
  });

  useEffect(() => {
    if (isError && error) addToast("Unable to load tokens. Please try again in a moment.", "error");
  }, [isError, error, addToast]);

  useEffect(() => {
    if (!publicKey) {
      setBagsLaunches([]);
      return;
    }
    try {
      const key = `siren-bags-launches-${publicKey.toBase58()}`;
      const raw = localStorage.getItem(key);
      setBagsLaunches(raw ? JSON.parse(raw) : []);
    } catch {
      setBagsLaunches([]);
    }
  }, [publicKey]);

  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens;
    const q = searchQuery.toLowerCase();
    return tokens.filter(
      (t) =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.symbol && t.symbol.toLowerCase().includes(q)) ||
        (t.mint && t.mint.toLowerCase().includes(q))
    );
  }, [tokens, searchQuery]);

  const { setSelectedToken } = useSirenStore();

  return (
    <div
      className="flex flex-col min-h-0 min-w-0 p-4 md:p-6 overflow-hidden"
      style={{ background: "var(--bg-void)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2
          className="font-heading font-semibold text-sm truncate max-w-[200px] md:max-w-none"
          style={{ color: "var(--text-2)" }}
        >
          {selectedMarket ? `${selectedMarket.title.slice(0, 60)}${selectedMarket.title.length > 60 ? "…" : ""}` : "Surfaced tokens"}
        </h2>
        <div className="flex items-center gap-2">
          {selectedMarket && (
            <>
              <MarketAlertButton ticker={selectedMarket.ticker} probability={selectedMarket.probability} />
              <StarButton type="market" id={selectedMarket.ticker} />
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  if (selectedMarket.kalshi_url) window.open(selectedMarket.kalshi_url, "_blank");
                  else setBuyPanelOpen(true, "market");
                }}
                className="font-body font-medium text-[11px] uppercase h-8 px-3 rounded-[6px] border transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-1)",
                }}
              >
                View on Kalshi
              </button>
              <button
                type="button"
                onClick={() => { hapticLight(); setDetailPanelOpen(true); }}
                className="text-[11px] text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                title="Market details"
              >
                &#9432;
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { hapticLight(); setLaunchPanelOpen(true); }}
            className="font-heading font-bold text-[11px] uppercase h-8 px-4 rounded-[6px] transition-all duration-[120ms] ease hover:opacity-90"
            style={{
              background: "var(--accent)",
              color: "var(--accent-text)",
              letterSpacing: "0.06em",
            }}
          >
            Launch token
          </button>
        </div>
      </div>
      {launchPanelOpen && <LaunchTokenPanel onClose={() => setLaunchPanelOpen(false)} />}
      <p className="font-body font-normal text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
        {selectedMarket
          ? "Tokens matched by keywords from the market title (DexScreener search). View on Kalshi to trade the market."
          : "New uprising tokens (DexScreener latest boosted)."}
      </p>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, symbol, or contract address"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full font-body text-xs h-[36px] px-4 rounded-[6px] border transition-all duration-[120ms] ease focus:border-[var(--border-active)] focus:outline-none focus:ring-0"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-1)",
          }}
        />
        <p className="font-body font-normal text-[11px] mt-1.5" style={{ color: "var(--text-3)" }}>
          DexScreener (Solana). Results appear as you type.
        </p>
      </div>
      {isError ? (
        <div
          className="rounded-[6px] border p-6 text-center flex flex-col items-center gap-3"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
            Unable to load tokens at the moment.
          </p>
          <button
            type="button"
            onClick={() => { hapticLight(); refetch(); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] font-body font-medium text-sm border transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-1)" }}
          >
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="token-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : (
        <div className="token-grid">
          {filteredTokens.map((t, i) => {
            const topBorder = getTokenCardTopBorder(t);
            const isUserLaunch = bagsLaunches.includes(t.mint);
            return (
              <motion.div
                key={t.mint}
                initial={{ opacity: 0, transform: "translateY(6px)" }}
                animate={{ opacity: 1, transform: "translateY(0)" }}
                transition={{ duration: 0.18, delay: i * 0.05, ease: "easeOut" }}
                className="rounded-[8px] p-3.5 cursor-pointer transition-all duration-[100ms] ease hover:bg-[var(--bg-elevated)] min-w-0 overflow-hidden"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderTop: `2px solid ${topBorder}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px var(--border-active)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
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
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    {t.imageUrl && (
                      <img
                        src={t.imageUrl}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    )}
                    <p className="font-heading font-bold text-sm truncate" style={{ color: "var(--text-1)" }}>
                      ${t.symbol}
                    </p>
                    <LaunchpadBadge launchpad={t.launchpad} />
                  </div>
                  <div className="flex items-center gap-0">
                    <TokenAlertButton mint={t.mint} symbol={t.symbol} price={t.price} />
                    <StarButton type="token" id={t.mint} />
                    <CopyCAButton mint={t.mint} />
                  </div>
                </div>
                <p
                  className="font-body font-normal text-[11px] truncate mb-2"
                  style={{ color: "var(--text-2)" }}
                >
                  {t.name}
                </p>
                {isUserLaunch && (
                  <p className="font-body text-[10px] mb-1" style={{ color: "var(--bags)" }}>
                    Launched on Bags (you)
                  </p>
                )}
                {selectedMarket && (
                  <div className="mb-2">
                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] mb-1"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--accent)" }}>
                        {selectedMarket.probability.toFixed(0)}%
                      </span>
                      <span className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
                        YES
                      </span>
                    </div>
                    <p className="font-body text-[10px] truncate" style={{ color: "var(--text-3)" }} title={selectedMarket.title}>
                      Linked to: {selectedMarket.title}
                    </p>
                  </div>
                )}
                {t.price != null && (
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-baseline gap-1">
                      <span className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                        ~$
                      </span>
                      <span className="font-mono text-[13px] tabular-nums" style={{ color: "var(--text-1)" }}>
                        {t.price.toFixed(4)}
                      </span>
                      <span className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                        USD
                      </span>
                    </div>
                    <MiniSparkline data={[t.price * 0.92, t.price * 0.96, t.price * 0.98, t.price, t.price]} width={48} height={18} />
                  </div>
                )}
                <div className="flex justify-between items-center mb-1">
                  <span className="font-body font-medium text-[10px] uppercase" style={{ color: "var(--text-3)" }}>
                    24h Vol
                  </span>
                  <span className="font-mono text-xs tabular-nums">
                    <span style={{ color: "var(--text-1)" }}>{t.volume24h?.toLocaleString() ?? "—"}</span>
                    <span style={{ color: "var(--text-3)" }}> SOL</span>
                    {t.volume24h != null && solPriceUsd > 0 && (
                      <span className="font-mono text-[10px] ml-1" style={{ color: "var(--text-3)" }}>
                        (≈${(t.volume24h * solPriceUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-body font-medium text-[10px] uppercase" style={{ color: "var(--text-3)" }}>
                    CT mentions
                  </span>
                  <span className="font-mono text-xs tabular-nums" style={{ color: "var(--text-1)" }}>
                    {t.ctMentions ?? "—"}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
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
            );
          })}
        </div>
      )}
      {!isLoading && !isError && tokens.length === 0 && (
        <div
          className="py-10 px-6 rounded-[8px] border border-dashed text-center"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <p className="font-body text-sm mb-2" style={{ color: "var(--text-2)" }}>
            {searchQuery
              ? "No tokens found for this search."
              : selectedMarket
                ? "No tokens found for this market."
                : "No tokens fetched or found yet."}
          </p>
          {!searchQuery && !selectedMarket && (
            <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
              Click a market in the sidebar to see tokens related to it.
            </p>
          )}
          {selectedMarket && !searchQuery && (
            <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
              Use &quot;Launch token&quot; above to create one.
            </p>
          )}
        </div>
      )}
      {!isLoading && !isError && tokens.length > 0 && filteredTokens.length === 0 && (
        <div
          className="py-6 px-4 rounded-[6px] text-center"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
            No tokens match your search. Try name, symbol, or contract address.
          </p>
        </div>
      )}
    </div>
  );
}
