"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { Copy, Check, ArrowUpRight, ExternalLink, Share2, Download, Loader2 } from "lucide-react";
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
import { formatProfileName, readProfileName } from "@/lib/profilePrefs";
import type { PredictionSignal, SurfacedToken } from "@siren/shared";
import { API_URL } from "@/lib/apiUrl";

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

function formatTimestampLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "Open-ended";
  const timestampMs = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestampMs);
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

function getSelectedMarketVenueLabel(market: SelectedMarket): string {
  return market.source === "kalshi" ? "Kalshi" : "Polymarket";
}

function getSelectedMarketSourceLabel(market: SelectedMarket): string {
  return market.source === "kalshi" ? "Kalshi" : "Polymarket";
}

function canTradeSelectedMarketInSiren(market: SelectedMarket): boolean {
  if (market.source === "kalshi") {
    return !!(market.yes_mint || market.no_mint);
  }
  return !!(market.yes_token_id || market.no_token_id);
}

function getSelectedMarketUrl(market: SelectedMarket): string {
  return market.market_url || market.kalshi_url || (market.source === "polymarket" ? "https://polymarket.com" : "https://kalshi.com");
}

function CompactMarketStat({
  label,
  value,
  tone = "var(--text-1)",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
      <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
        {label}
      </p>
      <p className="mt-2 font-mono text-lg font-semibold leading-none tabular-nums" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

function MarketShareExportCard({
  market,
  displayName,
  exportBrandLabel,
}: {
  market: SelectedMarket;
  displayName: string;
  exportBrandLabel: string;
}) {
  return (
    <div
      data-market-card-export="true"
      className="w-[760px] overflow-hidden rounded-[32px] border p-8"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 28%, var(--border-subtle))",
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 14%, transparent), transparent 42%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--polymarket) 10%, transparent), transparent 40%), linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
            Selected market
          </p>
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              borderColor: market.source === "kalshi" ? "color-mix(in srgb, var(--kalshi) 34%, transparent)" : "color-mix(in srgb, var(--polymarket) 34%, transparent)",
              background: market.source === "kalshi" ? "color-mix(in srgb, var(--kalshi) 12%, transparent)" : "color-mix(in srgb, var(--polymarket) 12%, transparent)",
              color: market.source === "kalshi" ? "var(--kalshi)" : "var(--polymarket)",
            }}
          >
            {getSelectedMarketSourceLabel(market)}
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
          {exportBrandLabel}
        </span>
      </div>

      <h2
        className="mt-8 max-w-[18ch] font-heading text-[58px] font-bold leading-[0.9] tracking-[-0.05em]"
        style={{ color: "var(--text-1)", fontFamily: '"Clash Display", sans-serif' }}
      >
        {market.title}
      </h2>

      <p className="mt-5 max-w-[40ch] font-body text-lg leading-relaxed" style={{ color: "var(--text-2)" }}>
        Trade it inside Siren, then use the matched token list if you want extra exposure.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <CompactMarketStat label="YES" value={formatCentsFromProbability(market.probability, "yes")} tone="var(--bags)" />
        <CompactMarketStat label="NO" value={formatCentsFromProbability(market.probability, "no")} tone="var(--down)" />
        <CompactMarketStat label="Move 1h" value={`${market.velocity_1h >= 0 ? "+" : ""}${market.velocity_1h.toFixed(1)}%`} tone={market.velocity_1h >= 0 ? "var(--up)" : "var(--down)"} />
        <CompactMarketStat label="Closes" value={formatTimestampLabel(market.close_time)} />
      </div>

      <div className="mt-10 flex items-end justify-between gap-4 border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
            Shared by
          </p>
          <p className="mt-1 font-heading text-xl font-semibold" style={{ color: "var(--text-1)", fontFamily: '"Clash Display", sans-serif' }}>
            {displayName}
          </p>
        </div>
        <div className="text-right">
          <img src="/brand/mark.svg" alt="Siren" className="ml-auto h-7 w-auto" />
          <p className="mt-2 font-mono text-sm" style={{ color: "var(--accent)" }}>
            onsiren.xyz
          </p>
        </div>
      </div>
    </div>
  );
}

function PredictionMarketFocusPanel({
  market,
  onPrimaryAction,
  onOpenVenue,
  onBrowseTokens,
  onShareCard,
  onDownloadCard,
  exportingCard,
  displayName,
}: {
  market: SelectedMarket;
  onPrimaryAction: () => void;
  onOpenVenue: () => void;
  onBrowseTokens: () => void;
  onShareCard: () => void;
  onDownloadCard: () => void;
  exportingCard: boolean;
  displayName: string;
}) {
  const { data: marketActivity } = useMarketActivity(market.source === "kalshi" ? market.ticker : undefined);
  const canTradeInSiren = canTradeSelectedMarketInSiren(market);

  return (
    <section
      className="mb-5 overflow-hidden rounded-[22px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border-subtle))",
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 38%), linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
      }}
    >
      <div className="grid gap-5 px-4 py-4 sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                Selected market
              </p>
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  borderColor: market.source === "kalshi" ? "color-mix(in srgb, var(--kalshi) 34%, transparent)" : "color-mix(in srgb, var(--polymarket) 34%, transparent)",
                  background: market.source === "kalshi" ? "color-mix(in srgb, var(--kalshi) 12%, transparent)" : "color-mix(in srgb, var(--polymarket) 12%, transparent)",
                  color: market.source === "kalshi" ? "var(--kalshi)" : "var(--polymarket)",
                }}
              >
                {getSelectedMarketSourceLabel(market)}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onShareCard}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-body text-[10px] font-medium"
                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-1)" }}
              >
                {exportingCard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                Share
              </button>
              <button
                type="button"
                onClick={onDownloadCard}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-body text-[10px] font-medium"
                style={{ borderColor: "var(--border-subtle)", background: "transparent", color: "var(--text-2)" }}
              >
                {exportingCard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download
              </button>
            </div>
          </div>

          <h2
            className="mt-4 max-w-[18ch] break-words font-heading text-[clamp(1.15rem,2vw,1.8rem)] font-bold leading-[0.95] tracking-[-0.045em]"
            style={{ color: "var(--text-1)" }}
          >
            {market.title}
          </h2>

          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Trade it inside Siren, then use the matched token list below if you want extra exposure.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CompactMarketStat label="YES" value={formatCentsFromProbability(market.probability, "yes")} tone="var(--bags)" />
            <CompactMarketStat label="NO" value={formatCentsFromProbability(market.probability, "no")} tone="var(--down)" />
            <CompactMarketStat label="Closes" value={formatTimestampLabel(market.close_time)} />
            <CompactMarketStat
              label={market.source === "kalshi" ? "Trades 24h" : "Liquidity"}
              value={
                market.source === "kalshi"
                  ? formatCompactNumber(marketActivity?.recentTrades?.length, 0)
                  : formatCompactNumber(market.liquidity, 1)
              }
            />
          </div>
        </div>

        <div
          className="rounded-[20px] border p-4"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
            background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 92%, transparent), var(--bg-surface))",
          }}
        >
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
            Quick actions
          </p>
          <p className="mt-1 font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
            Shared as {displayName}. Venue page stays optional.
          </p>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 font-heading text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              {canTradeInSiren ? "Trade in Siren" : "View matched tokens"}
            </button>
            <button
              type="button"
              onClick={onBrowseTokens}
              className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 font-body text-xs font-medium"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
            >
              Matched tokens
            </button>
            <button
              type="button"
              onClick={onOpenVenue}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-body text-xs font-medium"
              style={{ borderColor: "var(--border-subtle)", background: "transparent", color: "var(--text-2)" }}
            >
              Venue page
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
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
              Siren matched this {platformLabel} move to related Solana tokens below so you can react without jumping around the app.
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
                View market page
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
  const { selectedMarket, selectedSignal, setBuyPanelOpen } = useSirenStore();
  const { publicKey, evmAddress } = useSirenWallet();
  const [launchPanelOpen, setLaunchPanelOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [exportingCard, setExportingCard] = useState(false);
  const [bagsLaunches, setBagsLaunches] = useState<string[]>([]);
  const [cardDisplayName, setCardDisplayName] = useState("@siren");
  const [launchpadFilter, setLaunchpadFilter] = useState<"all" | "bags" | "pump" | "bonk" | "moonshot">("all");
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const shareCardRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const identity = publicKey?.toBase58() ?? evmAddress ?? null;
    setCardDisplayName(formatProfileName(readProfileName(identity)));
  }, [publicKey?.toBase58(), evmAddress]);

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

  const exportSelectedMarket = async (mode: "share" | "download") => {
    if (!selectedMarket || typeof window === "undefined") return;
    try {
      const cardNode = shareCardRef.current;
      if (!cardNode) {
        addToast("Card export is not ready yet. Try again in a second.", "error");
        return;
      }

      hapticLight();
      setExportingCard(true);
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 120));

      const dataUrl = await toPng(cardNode, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050508",
        skipFonts: false,
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return node.dataset.exportIgnore !== "true";
        },
      });

      const safeTicker = selectedMarket.ticker.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      const filename = `siren-market-${safeTicker || "card"}-${Date.now()}.png`;
      const blob = await fetch(dataUrl).then((response) => response.blob());
      const file = new File([blob], filename, { type: "image/png" });

      if (mode === "share" && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: selectedMarket.title,
          text: `${selectedMarket.title} • onsiren.xyz`,
        });
        addToast("Market image shared.", "success");
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      addToast(mode === "share" ? "Sharing is unavailable here, so the image was downloaded instead." : "Market image saved.", "success");
    } catch (error) {
      console.warn("Market card export failed", error);
      addToast("Could not save the market image right now.", "error");
    } finally {
      setExportingCard(false);
    }
  };

  return (
    <div
      ref={surfaceRef}
      className="flex flex-col h-full min-h-0 min-w-0 p-4 md:p-6 overflow-y-auto overflow-x-hidden"
      style={{ background: "var(--bg-void)" }}
    >
      {selectedMarket && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-[-9999px] top-0 opacity-0"
        >
          <div ref={shareCardRef}>
            <MarketShareExportCard market={selectedMarket} displayName={cardDisplayName} exportBrandLabel="onsiren.xyz" />
          </div>
        </div>
      )}
      {selectedMarket ? (
        <PredictionMarketFocusPanel
          market={selectedMarket}
          onPrimaryAction={() => {
            hapticLight();
            if (canTradeSelectedMarketInSiren(selectedMarket)) {
              setBuyPanelOpen(true, "market");
              return;
            }
            tokenSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onOpenVenue={() => {
            hapticLight();
            window.open(getSelectedMarketUrl(selectedMarket), "_blank", "noopener,noreferrer");
          }}
          onBrowseTokens={() => {
            hapticLight();
            tokenSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onShareCard={() => exportSelectedMarket("share")}
          onDownloadCard={() => exportSelectedMarket("download")}
          exportingCard={exportingCard}
          displayName={cardDisplayName}
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
            Pick a market from the left and Siren will show the best matching tokens underneath it.
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
      <div
        className="mb-3 flex flex-col gap-2 rounded-[10px] border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
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
      <div ref={tokenSectionRef} className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2
          className="font-heading text-sm font-semibold"
          style={{ color: "var(--text-2)" }}
        >
          {selectedMarket ? "Tokens exposed to this market" : selectedSignal ? "Tokens linked to this signal" : "Surfaced tokens"}
        </h2>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          {selectedMarket && (
            <>
              {canTradeSelectedMarketInSiren(selectedMarket) ? (
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setBuyPanelOpen(true, "market");
                  }}
                  className="h-8 rounded-[6px] px-4 font-heading text-[11px] font-bold uppercase transition-all duration-[120ms] ease hover:opacity-90"
                  style={{
                    background: "var(--accent)",
                    color: "var(--accent-text)",
                    letterSpacing: "0.06em",
                  }}
                >
                  Trade market
                </button>
              ) : null}
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
          ? "These tokens are ranked by how closely they match the selected market."
          : selectedSignal
            ? "These tokens were matched from the signal text and surfaced from the live feed."
          : "Browse tokens from Siren search, Bags launches, and DexScreener results."}
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
                className="min-w-0 cursor-pointer overflow-hidden rounded-[14px] p-3 transition-all duration-[100ms] ease hover:bg-[var(--bg-elevated)]"
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
                <div className="grid gap-3 md:grid-cols-[56px_minmax(0,1fr)] xl:grid-cols-[56px_minmax(0,1fr)_auto] xl:items-center">
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

                  <div className="flex flex-wrap items-center gap-1.5 md:col-span-2 xl:col-span-1 xl:justify-end">
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
                      className="h-9 shrink-0 rounded-[9px] px-4 font-heading text-[11px] font-semibold uppercase transition-all duration-[80ms] ease hover:brightness-[1.08]"
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
