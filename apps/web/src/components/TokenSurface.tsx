"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Copy, Check, ArrowUpRight, ExternalLink, Activity } from "lucide-react";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useMarketActivity } from "@/hooks/useMarketActivity";
import { useSirenStore, type SelectedMarket } from "@/store/useSirenStore";
import { useToastStore } from "@/store/useToastStore";
import { LaunchTokenPanel } from "@/components/LaunchTokenPanel";
import { StarButton } from "./StarButton";
import { TokenAlertButton } from "./AlertButton";
import { MarketAlertButton } from "./AlertButton";
import { LaunchpadBadge } from "./LaunchpadBadge";
import { hapticLight } from "@/lib/haptics";
import type { PredictionSignal, SurfacedToken } from "@siren/shared";

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
  if (token.riskBlocked || (token.riskScore ?? 0) >= 80) return "var(--down)";
  if ((token.riskScore ?? 0) >= 60) return "var(--bags)";
  const ct = token.ctMentions ?? 0;
  const vol = token.volume24h ?? 0;
  if (ct > 10) return "var(--bags)";
  if (vol > 50) return "var(--kalshi)";
  return "var(--border-subtle)";
}

function formatCompactNumber(value?: number, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value?: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatCentsFromProbability(probability?: number | null, side: "yes" | "no" = "yes"): string {
  if (probability == null || !Number.isFinite(probability)) return "—";
  const yes = Math.min(100, Math.max(0, probability));
  const cents = side === "yes" ? yes : 100 - yes;
  return `${cents.toFixed(1)}c`;
}

function SignalSourcePill({ source }: { source: PredictionSignal["source"] }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{
        background: source === "kalshi" ? "#00B2FF" : "#6B3FDB",
        color: "#FFFFFF",
      }}
    >
      {source === "kalshi" ? "KALSHI" : "POLYMARKET"}
    </span>
  );
}

function PredictionMarketFocusPanel({
  market,
  onTrade,
  onOpenKalshi,
  onBrowseTokens,
}: {
  market: SelectedMarket;
  onTrade: () => void;
  onOpenKalshi: () => void;
  onBrowseTokens: () => void;
}) {
  const { data: marketActivity } = useMarketActivity(market.ticker);
  return (
    <section
      className="mb-5 overflow-hidden rounded-[22px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border-subtle))",
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 38%), linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
      }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
              Selected market
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold leading-tight md:text-[2rem]" style={{ color: "var(--text-1)" }}>
              {market.title}
            </h2>
            {market.subtitle && (
              <p className="mt-2 max-w-xl font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                {market.subtitle}
              </p>
            )}
            <p className="mt-3 max-w-2xl font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
              Trade YES or NO here, then buy related tokens below.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onTrade}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Trade market
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onBrowseTokens}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-body text-xs font-medium"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
            >
              Buy linked tokens
            </button>
            <button
              type="button"
              onClick={onOpenKalshi}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-body text-xs font-medium"
              style={{ borderColor: "var(--border-subtle)", background: "transparent", color: "var(--text-2)" }}
            >
              Trade on Kalshi
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            YES price
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--bags)" }}>
            {formatCentsFromProbability(market.probability, "yes")}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Implied YES probability {formatPercent(market.probability)}
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            NO price
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--down)" }}>
            {formatCentsFromProbability(market.probability, "no")}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Implied NO probability {formatPercent(100 - market.probability)}
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            1h velocity
          </p>
          <p
            className="mt-2 font-mono text-2xl font-semibold tabular-nums"
            style={{ color: market.velocity_1h >= 0 ? "var(--up)" : "var(--down)" }}
          >
            {market.velocity_1h >= 0 ? "+" : ""}{market.velocity_1h.toFixed(1)}%
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Directional move across the last hour
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Volume
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(market.volume, 1)}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Lifetime filled contracts in this market
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Volume 24h
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(market.volume_24h, 1)}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Contracts filled across the last 24 hours
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Trades 24h
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(marketActivity?.recent_trades_24h, 0)}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Public fills, not unique traders
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Liquidity
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(market.liquidity, 1)}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Event liquidity available in the current book
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              Open interest
            </p>
            <Activity className="h-4 w-4" style={{ color: "var(--text-3)" }} />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(market.open_interest, 1)}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Open contracts still exposed to resolution
          </p>
        </div>
      </div>
    </section>
  );
}

function SignalNarrativePanel({
  signal,
  onBrowseTokens,
}: {
  signal: PredictionSignal;
  onBrowseTokens: () => void;
}) {
  const platformLabel = signal.source === "kalshi" ? "Kalshi" : "Polymarket";
  return (
    <section
      className="mb-5 overflow-hidden rounded-[22px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border-subtle))",
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 38%), linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
      }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
              Signal narrative
            </p>
            <div className="mt-2 flex items-center gap-2">
              <SignalSourcePill source={signal.source} />
              <span className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                Live movement detected in the last minute
              </span>
            </div>
            <h2 className="mt-3 font-heading text-2xl font-bold leading-tight md:text-[2rem]" style={{ color: "var(--text-1)" }}>
              {signal.question}
            </h2>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              Siren mapped this {platformLabel} move into linked Solana meme tokens below so you can react from the same terminal.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBrowseTokens}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Buy linked tokens
              <ArrowUpRight className="h-4 w-4" />
            </button>
            {signal.marketUrl && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  window.open(signal.marketUrl, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-body text-xs font-medium"
                style={{ borderColor: "var(--border-subtle)", background: "transparent", color: "var(--text-2)" }}
              >
                Open on {platformLabel}
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            YES probability
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
            {signal.currentProb.toFixed(1)}%
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Current implied probability
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Move
          </p>
          <p
            className="mt-2 font-mono text-2xl font-semibold tabular-nums"
            style={{ color: signal.delta >= 0 ? "var(--up)" : "var(--down)" }}
          >
            {signal.delta >= 0 ? "+" : ""}
            {signal.delta.toFixed(1)}%
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            From {signal.previousProb.toFixed(1)}% one minute ago
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Direction
          </p>
          <p
            className="mt-2 font-mono text-2xl font-semibold tabular-nums"
            style={{ color: signal.direction === "up" ? "var(--up)" : "var(--down)" }}
          >
            {signal.direction === "up" ? "UP" : "DOWN"}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Largest moves stay at the top of the feed
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Volume
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(signal.volume, 1)}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Venue-reported market volume
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Order book
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {signal.book?.bestBid != null && signal.book?.bestAsk != null
              ? `${signal.book.bestBid.toFixed(1)} / ${signal.book.bestAsk.toFixed(1)}`
              : "—"}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Best bid / ask on the YES token
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Linked tokens
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {signal.matchedTokens.length}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Solana tokens matched from the event language
          </p>
        </div>
      </div>
    </section>
  );
}

export function TokenSurface() {
  const { selectedMarket, selectedSignal, setBuyPanelOpen, setDetailPanelOpen } = useSirenStore();
  const { publicKey } = useSirenWallet();
  const [launchPanelOpen, setLaunchPanelOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [bagsLaunches, setBagsLaunches] = useState<string[]>([]);
  const [launchpadFilter, setLaunchpadFilter] = useState<"all" | "bags" | "pump" | "bonk" | "moonshot">("all");
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const tokenSectionRef = useRef<HTMLDivElement | null>(null);

  const searchQuery = searchInput.trim();
  const keywordsForApi = useMemo(() => (searchQuery ? [searchQuery] : selectedMarket?.keywords ?? []), [searchQuery, selectedMarket?.keywords]);
  const tokenQueryEnabled = !selectedSignal;

  const addToast = useToastStore((s) => s.addToast);
  const { data: tokens = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tokens", selectedMarket?.ticker, selectedSignal?.id, keywordsForApi.join(",")],
    queryFn: () => fetchTokens(selectedMarket?.ticker, undefined, keywordsForApi.length ? keywordsForApi : undefined),
    enabled: tokenQueryEnabled,
    retry: 2,
    refetchInterval: tokenQueryEnabled && !searchQuery ? 60_000 : false,
    staleTime: tokenQueryEnabled && searchQuery ? 10_000 : 30_000,
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

  useEffect(() => {
    if (!selectedMarket?.ticker && !selectedSignal?.id) return;
    surfaceRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedMarket?.ticker, selectedSignal?.id]);

  const tokenRows = selectedSignal ? selectedSignal.matchedTokens : tokens;

  const filteredTokens = useMemo(() => {
    const launchpadScoped = launchpadFilter === "all" ? tokenRows : tokenRows.filter((t) => t.launchpad === launchpadFilter);
    if (!searchQuery) return launchpadScoped;
    const q = searchQuery.toLowerCase();
    return launchpadScoped.filter(
      (t) =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.symbol && t.symbol.toLowerCase().includes(q)) ||
        (t.mint && t.mint.toLowerCase().includes(q))
    );
  }, [tokenRows, searchQuery, launchpadFilter]);
  const riskyTokens = useMemo(() => filteredTokens.filter((t) => (t.riskScore ?? 0) >= 60), [filteredTokens]);

  const { setSelectedToken } = useSirenStore();

  return (
    <div
      ref={surfaceRef}
      className="flex flex-col h-full min-h-0 min-w-0 p-4 md:p-6 overflow-y-auto overflow-x-hidden"
      style={{ background: "var(--bg-void)" }}
    >
      {selectedMarket ? (
        <PredictionMarketFocusPanel
          market={selectedMarket}
          onTrade={() => {
            hapticLight();
            setBuyPanelOpen(true, "market");
          }}
          onOpenKalshi={() => {
            hapticLight();
            if (selectedMarket.kalshi_url) window.open(selectedMarket.kalshi_url, "_blank", "noopener,noreferrer");
            else setBuyPanelOpen(true, "market");
          }}
          onBrowseTokens={() => {
            hapticLight();
            tokenSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      ) : selectedSignal ? (
        <SignalNarrativePanel
          signal={selectedSignal}
          onBrowseTokens={() => {
            hapticLight();
            tokenSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      ) : (
        <div
          className="mb-5 rounded-[20px] border px-5 py-5"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
            Prediction Markets First
          </p>
          <h2 className="mt-2 font-heading text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Pick a market to center the terminal.
          </h2>
          <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Siren is built around live prediction markets. Select one from the left rail and we will map the relevant YES/NO trade plus the surrounding token flow underneath it.
          </p>
        </div>
      )}

      <div className="mb-3">
        <input
          type="text"
          placeholder={
            selectedMarket || selectedSignal
              ? "Search linked tokens by name, symbol, or contract address"
              : "Search tokens by name, symbol, or contract address"
          }
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
      <div className="mb-3 rounded-[10px] border px-3 py-2 flex items-center justify-between gap-2" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hidden">
          {[
            { id: "all", label: "All", logoUrl: "", fallback: "A" },
            { id: "bags", label: "Bags", logoUrl: "https://bags.fm/assets/images/bags-icon.png", fallback: "B" },
            { id: "pump", label: "Pump", logoUrl: "https://pump.fun/favicon.ico", fallback: "P" },
            { id: "bonk", label: "Bonk", logoUrl: "https://brand.bonkcoin.com/_next/image?url=%2Fimages%2Flogo.png&w=640&q=75", fallback: "B" },
            { id: "moonshot", label: "Moonshot", logoUrl: "https://moonshot.money/favicon.ico", fallback: "M" },
          ].map((item) => {
            const isActive = launchpadFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setLaunchpadFilter(item.id as "all" | "bags" | "pump" | "bonk" | "moonshot")}
                className="h-7 px-2.5 rounded-full border text-[11px] font-body whitespace-nowrap inline-flex items-center gap-1.5"
                style={{
                  background: isActive ? "var(--bg-elevated)" : "transparent",
                  color: isActive ? "var(--text-1)" : "var(--text-3)",
                  borderColor: isActive ? "var(--border-active)" : "var(--border-subtle)",
                }}
              >
                <span className="w-4 h-4 rounded-full border inline-flex items-center justify-center overflow-hidden" style={{ borderColor: isActive ? "var(--accent)" : "var(--border-subtle)", background: "var(--bg-base)" }}>
                  {item.logoUrl ? (
                    <img src={item.logoUrl} alt={item.label} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[9px]">{item.fallback}</span>
                  )}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="h-7 px-3 rounded-[7px] border text-[11px] font-body"
          style={{ background: "var(--bg-elevated)", color: "var(--text-2)", borderColor: "var(--border-subtle)" }}
        >
          Token filters
        </button>
      </div>
      <div ref={tokenSectionRef} className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2
          className="font-heading font-semibold text-sm truncate max-w-[200px] md:max-w-none"
          style={{ color: "var(--text-2)" }}
        >
          {selectedMarket ? "Tokens exposed to this market" : selectedSignal ? "Tokens linked to this signal" : "Surfaced tokens"}
        </h2>
        <div className="flex items-center gap-2">
          {selectedMarket && (
            <>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setBuyPanelOpen(true, "market");
                }}
                className="font-heading font-bold text-[11px] uppercase h-8 px-4 rounded-[6px] transition-all duration-[120ms] ease hover:opacity-90"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-text)",
                  letterSpacing: "0.06em",
                }}
              >
                Trade market
              </button>
              <MarketAlertButton ticker={selectedMarket.ticker} probability={selectedMarket.probability} />
              <StarButton type="market" id={selectedMarket.ticker} />
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
      <p className="font-body font-normal text-[11px] mb-2" style={{ color: "var(--text-3)" }}>
        {selectedMarket
          ? "These tokens are ranked by how closely they map to the selected market."
          : selectedSignal
            ? "These tokens were matched from the signal language and surfaced directly from the live feed."
          : "Cross-market discovery mix from Bags, boosted DexScreener names, and broader search themes."}
      </p>
      {riskyTokens.length > 0 && (
        <div
          className="rounded-[8px] border px-3 py-2 mb-3"
          style={{
            background: "color-mix(in srgb, var(--down) 8%, var(--bg-surface))",
            borderColor: "color-mix(in srgb, var(--down) 26%, var(--border-subtle))",
          }}
        >
          <p className="font-body text-[11px]" style={{ color: "var(--text-2)" }}>
            Elevated risk found in some tokens. Trade carefully.
          </p>
        </div>
      )}
      <div className="mb-1" />
      {tokenQueryEnabled && isError ? (
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
      ) : tokenQueryEnabled && isLoading ? (
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
                className="rounded-[14px] p-2.5 cursor-pointer transition-all duration-[100ms] ease hover:bg-[var(--bg-elevated)] min-w-0 overflow-hidden"
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
                    liquidityUsd: t.liquidityUsd,
                    fdvUsd: t.fdvUsd,
                    holders: t.holders,
                    bondingCurveStatus: t.bondingCurveStatus,
                    rugcheckScore: t.rugcheckScore,
                    safe: t.safe,
                    riskScore: t.riskScore,
                    riskLabel: t.riskLabel,
                    riskReasons: t.riskReasons,
                    riskBlocked: t.riskBlocked,
                  });
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-[56px] h-[56px] rounded-[10px] border shrink-0 overflow-hidden" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
                    <img
                      src={t.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.symbol || t.name)}&background=0F172A&color=E2E8F0&size=64`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.symbol || t.name)}&background=0F172A&color=E2E8F0&size=64`;
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-heading font-semibold text-sm truncate" style={{ color: "var(--text-1)" }}>
                        ${t.symbol}
                      </p>
                      <LaunchpadBadge launchpad={t.launchpad} />
                      {isUserLaunch && (
                        <span className="font-body text-[10px]" style={{ color: "var(--bags)" }}>
                          Yours
                        </span>
                      )}
                    </div>
                    <p className="font-body text-[11px] truncate mt-0.5" style={{ color: "var(--text-2)" }}>
                      {t.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-body text-[11px] tabular-nums" style={{ color: "var(--text-1)" }}>
                        ${t.price != null ? t.price.toFixed(4) : "—"}
                      </span>
                      <span className="font-body text-[11px] tabular-nums" style={{ color: "var(--text-3)" }}>
                        Vol ${t.volume24h?.toLocaleString() ?? "—"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-body" style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}>
                        {t.bondingCurveStatus === "bonded" ? "Bonded" : t.bondingCurveStatus === "bonding" ? "Curve" : "Status —"}
                      </span>
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-body" style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}>
                        Holders {formatCompactNumber(t.holders, 0)}
                      </span>
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-body" style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}>
                        Liq ${formatCompactNumber(t.liquidityUsd)}
                      </span>
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-body" style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}>
                        FDV ${formatCompactNumber(t.fdvUsd)}
                      </span>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] font-body"
                        style={{
                          borderColor: t.safe === false ? "color-mix(in srgb, var(--down) 35%, var(--border-subtle))" : "var(--border-subtle)",
                          color: t.safe === false ? "var(--down)" : "var(--bags)",
                        }}
                      >
                        {t.rugcheckScore != null ? `Rug ${t.rugcheckScore}` : t.safe === false ? "Watch" : "Safe"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <TokenAlertButton mint={t.mint} symbol={t.symbol} price={t.price} />
                    <StarButton type="token" id={t.mint} />
                    <CopyCAButton mint={t.mint} />
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
                          liquidityUsd: t.liquidityUsd,
                          fdvUsd: t.fdvUsd,
                          holders: t.holders,
                          bondingCurveStatus: t.bondingCurveStatus,
                          rugcheckScore: t.rugcheckScore,
                          safe: t.safe,
                          riskScore: t.riskScore,
                          riskLabel: t.riskLabel,
                          riskReasons: t.riskReasons,
                          riskBlocked: t.riskBlocked,
                        });
                        setBuyPanelOpen(true, "token");
                      }}
                      className="h-9 px-4 rounded-[9px] font-heading font-semibold text-[11px] uppercase transition-all duration-[80ms] ease hover:brightness-[1.08] shrink-0"
                      style={{
                        background: "transparent",
                        color: "var(--text-1)",
                        border: "1px solid var(--border-default)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Buy
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      {!isLoading && !isError && tokenRows.length === 0 && (
        <div
          className="py-10 px-6 rounded-[8px] border border-dashed text-center"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <p className="font-body text-sm mb-2" style={{ color: "var(--text-2)" }}>
            {searchQuery
              ? "No safe tokens found for this search."
              : selectedMarket
                ? "No safe tokens found for this market."
                : selectedSignal
                  ? "No safe tokens matched this signal yet."
                : "No safe tokens fetched or found yet."}
          </p>
          {!searchQuery && !selectedMarket && !selectedSignal && (
            <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
              Click a market in the sidebar to see tokens related to it. Risky tokens are hidden automatically.
            </p>
          )}
          {(selectedMarket || selectedSignal) && !searchQuery && (
            <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
              Use &quot;Launch token&quot; above to create one.
            </p>
          )}
        </div>
      )}
      {!isLoading && !isError && tokenRows.length > 0 && filteredTokens.length === 0 && (
        <div
          className="py-6 px-4 rounded-[6px] text-center"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
            No safe tokens match your search. Try name, symbol, or contract address.
          </p>
        </div>
      )}
    </div>
  );
}
