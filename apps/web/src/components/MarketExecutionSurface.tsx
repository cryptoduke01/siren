"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getFontEmbedCSS, toPng } from "html-to-image";
import { ExternalLink, Share2, Download, Loader2 } from "lucide-react";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useMarketActivity } from "@/hooks/useMarketActivity";
import { useSirenStore, type SelectedMarket } from "@/store/useSirenStore";
import { useToastStore } from "@/store/useToastStore";
import { StarButton } from "./StarButton";
import { MarketAlertButton } from "./AlertButton";
import { hapticLight } from "@/lib/haptics";
import { formatProfileName, readProfileName } from "@/lib/profilePrefs";
import type { PredictionSignal } from "@siren/shared";

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
        Execution and risk intelligence for this outcome — trade with DFlow or Polymarket routing from Siren.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <CompactMarketStat label="YES" value={formatCentsFromProbability(market.probability, "yes")} tone="var(--accent)" />
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

function formatCompactNumber(value?: number, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(value);
}

function PredictionMarketFocusPanel({
  market,
  onPrimaryAction,
  onOpenVenue,
  onShareCard,
  onDownloadCard,
  exportingCard,
}: {
  market: SelectedMarket;
  onPrimaryAction: () => void;
  onOpenVenue: () => void;
  onShareCard: () => void;
  onDownloadCard: () => void;
  exportingCard: boolean;
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
              <StarButton type="market" id={market.ticker} />
              <MarketAlertButton ticker={market.ticker} probability={market.probability} />
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
                Save
              </button>
            </div>
          </div>

          <h2
            className="mt-4 max-w-[17ch] break-words font-heading text-[clamp(1.05rem,1.8vw,1.55rem)] font-bold leading-[0.95] tracking-[-0.045em]"
            style={{ color: "var(--text-1)" }}
          >
            {market.title}
          </h2>

          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Size YES or NO with execution-aware routing. Kalshi outcomes via DFlow; Polymarket via your linked wallet when
            available.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CompactMarketStat label="YES" value={formatCentsFromProbability(market.probability, "yes")} tone="var(--accent)" />
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
            Actions
          </p>
          <p className="mt-1 font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
            Trade in-terminal or open the venue for research and context.
          </p>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 font-heading text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              {canTradeInSiren ? "Trade" : "Open venue"}
            </button>
            <button
              type="button"
              onClick={onOpenVenue}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-body text-xs font-medium"
              style={{ borderColor: "var(--border-subtle)", background: "transparent", color: "var(--text-2)" }}
            >
              Market page
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SignalNarrativePanel({ signal }: { signal: PredictionSignal }) {
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
              Live signal
            </p>
            <div className="mt-2 flex items-center gap-2">
              <SignalSourcePill source={signal.source} />
              <span className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                Movement detected in the last minute
              </span>
            </div>
            <h2 className="mt-3 font-heading text-2xl font-bold leading-tight md:text-[2rem]" style={{ color: "var(--text-1)" }}>
              {signal.question}
            </h2>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              {platformLabel} move surfaced for fast review. Select the market in the feed to trade with execution and risk
              context in Siren.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
                Open venue
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            YES probability
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
            {signal.currentProb.toFixed(1)}%
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
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Volume
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(signal.volume, 1)}
          </p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Book
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {signal.book?.bestBid != null && signal.book?.bestAsk != null
              ? `${signal.book.bestBid.toFixed(1)} / ${signal.book.bestAsk.toFixed(1)}`
              : "—"}
          </p>
          <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Best bid / ask (YES)
          </p>
        </div>
      </div>
    </section>
  );
}

export function MarketExecutionSurface({ compactMode = false }: { compactMode?: boolean } = {}) {
  const { selectedMarket, selectedSignal, setBuyPanelOpen } = useSirenStore();
  const { publicKey, evmAddress } = useSirenWallet();
  const [exportingCard, setExportingCard] = useState(false);
  const [cardDisplayName, setCardDisplayName] = useState("@siren");
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const fontEmbedCssRef = useRef<string | null>(null);

  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    const identity = publicKey?.toBase58() ?? evmAddress ?? null;
    setCardDisplayName(formatProfileName(readProfileName(identity)));
  }, [publicKey?.toBase58(), evmAddress]);

  useEffect(() => {
    if (!selectedMarket?.ticker && !selectedSignal?.id) return;
    surfaceRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedMarket?.ticker, selectedSignal?.id]);

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
      if (!fontEmbedCssRef.current) {
        fontEmbedCssRef.current = await getFontEmbedCSS(cardNode);
      }
      const dataUrl = await toPng(cardNode, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050508",
        skipFonts: false,
        fontEmbedCSS: fontEmbedCssRef.current ?? undefined,
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
        await navigator.share({ files: [file], title: selectedMarket.title, text: `${selectedMarket.title} • onsiren.xyz` });
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
        <div aria-hidden="true" className="pointer-events-none fixed left-[-9999px] top-0 opacity-0">
          <div ref={shareCardRef}>
            <MarketShareExportCard market={selectedMarket} displayName={cardDisplayName} exportBrandLabel="onsiren.xyz" />
          </div>
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {selectedMarket && !compactMode ? (
          <motion.div
            key={`m-${selectedMarket.ticker}`}
            className="mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <PredictionMarketFocusPanel
              market={selectedMarket}
              onPrimaryAction={() => {
                hapticLight();
                if (canTradeSelectedMarketInSiren(selectedMarket)) {
                  setBuyPanelOpen(true, "market");
                  return;
                }
                window.open(getSelectedMarketUrl(selectedMarket), "_blank", "noopener,noreferrer");
              }}
              onOpenVenue={() => {
                hapticLight();
                window.open(getSelectedMarketUrl(selectedMarket), "_blank", "noopener,noreferrer");
              }}
              onShareCard={() => exportSelectedMarket("share")}
              onDownloadCard={() => exportSelectedMarket("download")}
              exportingCard={exportingCard}
            />
          </motion.div>
        ) : selectedMarket && compactMode ? (
          <motion.div
            key={`mc-${selectedMarket.ticker}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <PredictionMarketFocusPanel
              market={selectedMarket}
              onPrimaryAction={() => {
                hapticLight();
                if (canTradeSelectedMarketInSiren(selectedMarket)) {
                  setBuyPanelOpen(true, "market");
                  return;
                }
                window.open(getSelectedMarketUrl(selectedMarket), "_blank", "noopener,noreferrer");
              }}
              onOpenVenue={() => {
                hapticLight();
                window.open(getSelectedMarketUrl(selectedMarket), "_blank", "noopener,noreferrer");
              }}
              onShareCard={() => exportSelectedMarket("share")}
              onDownloadCard={() => exportSelectedMarket("download")}
              exportingCard={exportingCard}
            />
          </motion.div>
        ) : selectedSignal ? (
          <motion.div
            key={`s-${selectedSignal.id}`}
            className="mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SignalNarrativePanel signal={selectedSignal} />
          </motion.div>
        ) : (
          <motion.div
            key="surface-empty"
            className="mb-4 rounded-xl border px-4 py-3"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
              Select a prediction market
            </p>
            <p className="mt-0.5 font-body text-xs" style={{ color: "var(--text-3)" }}>
              Pick an event from the left feed to see execution context and trade.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
