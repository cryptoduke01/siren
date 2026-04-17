"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getFontEmbedCSS, toPng } from "html-to-image";
import { ExternalLink, Share2, Download, Loader2 } from "lucide-react";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useMarketActivity } from "@/hooks/useMarketActivity";
import { useMarketExecutionPreview } from "@/hooks/useMarketExecutionPreview";
import { useJupiterPredictionMap } from "@/hooks/useJupiterPredictionMap";
import { useSirenStore, type SelectedMarket } from "@/store/useSirenStore";
import { useToastStore } from "@/store/useToastStore";
import { StarButton } from "./StarButton";
import { MarketAlertButton } from "./AlertButton";
import { hapticLight } from "@/lib/haptics";
import { formatProfileName, readProfileName } from "@/lib/profilePrefs";
import type { PredictionSignal } from "@siren/shared";

function SignalSourcePill({ source }: { source: PredictionSignal["source"] }) {
  const isKalshi = source === "kalshi";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{
        background: isKalshi
          ? "color-mix(in srgb, var(--kalshi) 18%, var(--bg-surface))"
          : "color-mix(in srgb, var(--polymarket) 18%, var(--bg-surface))",
        color: isKalshi ? "var(--kalshi)" : "var(--polymarket)",
        border: `1px solid ${isKalshi
          ? "color-mix(in srgb, var(--kalshi) 32%, transparent)"
          : "color-mix(in srgb, var(--polymarket) 32%, transparent)"}`,
      }}
    >
      {isKalshi ? "KALSHI" : "POLYMARKET"}
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

function getSelectedOutcomeLabel(market: SelectedMarket): string | null {
  return market.selected_outcome_label?.trim() || null;
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

function getHoursUntilClose(value?: number | null): number | null {
  if (!value || !Number.isFinite(value)) return null;
  const timestampMs = value < 1_000_000_000_000 ? value * 1000 : value;
  return (timestampMs - Date.now()) / (1000 * 60 * 60);
}

function formatResolutionWindow(value?: number | null): string {
  const hours = getHoursUntilClose(value);
  if (hours == null) return "Open-ended";
  if (hours <= 0) return "Resolving now";
  if (hours < 1) return "< 1h left";
  if (hours < 24) return `${Math.round(hours)}h left`;
  const days = hours / 24;
  if (days < 7) return `${Math.round(days)}d left`;
  return formatTimestampLabel(value);
}

function ExecutionIntelligencePanel({ market }: { market: SelectedMarket }) {
  const hasNativeRoute = canTradeSelectedMarketInSiren(market);
  const closeHours = getHoursUntilClose(market.close_time);
  const liquidity = typeof market.liquidity === "number" ? market.liquidity : null;
  const fastMove = Math.abs(market.velocity_1h ?? 0) >= 4;
  const selectedOutcomeLabel = getSelectedOutcomeLabel(market);

  let routeLabel = "Routable now";
  let routeTone = "var(--accent)";
  let routeCopy = selectedOutcomeLabel
    ? `Route exists inside Siren for ${selectedOutcomeLabel}. Normal-sized orders should have a cleaner path than research-only markets.`
    : "Route exists inside Siren. Normal-sized orders should have a cleaner path than research-only markets.";

  if (!hasNativeRoute) {
    routeLabel = "Venue only";
    routeTone = "var(--text-2)";
    routeCopy = "This market is visible in Siren, but no native execution route is mapped here yet. Use the venue page for now.";
  } else if (liquidity != null && liquidity < 50_000) {
    routeLabel = "Thin size";
    routeTone = "var(--yellow)";
    routeCopy = "Route exists, but displayed liquidity looks light. Expect better outcomes with smaller clips or more patience.";
  }

  let riskLabel = "Standard watch";
  let riskTone = "var(--text-2)";
  let riskCopy = "Resolution is not immediate, so execution risk is more about size and timing than a closing window.";

  if (closeHours != null && closeHours <= 24) {
    riskLabel = "Resolution window";
    riskTone = "var(--down)";
    riskCopy = "This event is close to resolution. Books can thin quickly, so plan exits before the last-minute scramble.";
  } else if (fastMove) {
    riskLabel = "Fast tape";
    riskTone = "var(--yellow)";
    riskCopy = "Recent move is sharp enough to matter. Recheck odds and route quality before leaning into size.";
  }

  const failureCopy = !hasNativeRoute
    ? "If the trade is blocked, the issue is route availability rather than your wallet. Open the venue and monitor for Siren support."
    : liquidity != null && liquidity < 50_000
      ? "If size fails, the most likely reason is thin depth. Reduce order size, retry later, or split execution."
      : "If a trade fails here, it is more likely to be wallet, quote freshness, or venue-side availability than obvious market depth.";

  return (
    <section
      className="mb-5 overflow-hidden rounded-[22px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
        background:
          "radial-gradient(circle at bottom right, color-mix(in srgb, var(--kalshi) 8%, transparent), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 92%, transparent), var(--bg-base))",
      }}
    >
      <div className="grid gap-3 px-4 py-4 sm:px-5 sm:py-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
            Execution intelligence
          </p>
          <h3 className="mt-2 font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
            What Siren sees before you size this trade
          </h3>
          <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            A derived read from route availability, venue metadata, velocity, and the resolution window. This is the product direction in miniature: feasibility first, then risk.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <CompactMarketStat label="Route" value={routeLabel} tone={routeTone} />
            <CompactMarketStat label="Resolution" value={formatResolutionWindow(market.close_time)} tone={riskTone} />
            <CompactMarketStat
              label={market.source === "kalshi" ? "Velocity 1h" : "Liquidity"}
              value={
                market.source === "kalshi"
                  ? `${market.velocity_1h >= 0 ? "+" : ""}${market.velocity_1h.toFixed(1)}%`
                  : formatCompactNumber(liquidity ?? undefined, 1)
              }
              tone={fastMove ? "var(--yellow)" : "var(--text-1)"}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
            <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              Feasibility read
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              {routeCopy}
            </p>
          </div>
          <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
            <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              Risk watch
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              {riskCopy}
            </p>
          </div>
          <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
            <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              If it fails
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              {failureCopy}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatTradeCount(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return formatCompactNumber(value, 0);
}

function ExecutionPreviewPanel({
  market,
  walletKey,
}: {
  market: SelectedMarket;
  walletKey?: string | null;
}) {
  const { data, isLoading, isError } = useMarketExecutionPreview({
    ticker: market.event_ticker || market.ticker,
    outcomeTicker: market.ticker,
    wallet: market.source === "kalshi" ? walletKey : null,
  });

  if (isLoading) {
    return (
      <section
        className="mb-5 overflow-hidden rounded-[22px] border"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
      >
        <div className="flex items-center gap-3 px-5 py-4">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
            Building live execution preview...
          </p>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section
        className="mb-5 overflow-hidden rounded-[22px] border"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
      >
        <div className="px-5 py-4">
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
            Live route preview
          </p>
          <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Siren could not build a fresh execution preview right now. The market structure is still loaded, but live route probes need another try.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mb-5 overflow-hidden rounded-[22px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
        background:
          "radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 10%, transparent), transparent 36%), linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
      }}
    >
      <div className="grid gap-3 px-4 py-4 sm:px-5 sm:py-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
            Route preview
          </p>
          <h3 className="mt-2 font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
            Route confidence for {data.market.selectedOutcome.label}
          </h3>
          <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            {data.route.summary}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <CompactMarketStat
              label="Route mode"
              value={data.route.available ? "Siren route" : "Venue only"}
              tone={data.route.available ? "var(--accent)" : "var(--text-2)"}
            />
            <CompactMarketStat
              label="Suggested clip"
              value={data.route.suggestedClipUsd != null ? `$${data.route.suggestedClipUsd}` : "Start small"}
              tone={data.route.suggestedClipUsd != null ? "var(--up)" : "var(--text-1)"}
            />
            <CompactMarketStat
              label="Outcome rank"
              value={`#${data.risk.field.rank}`}
              tone={data.risk.field.rank === 1 ? "var(--accent)" : "var(--text-1)"}
            />
          </div>

          <div className="mt-4 rounded-[18px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
            <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              Probe ladder
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(data.route.probes.length > 0
                ? data.route.probes
                : [
                    {
                      amountUsd: data.route.suggestedClipUsd ?? 10,
                      status: data.route.walletConnected ? "skipped" : "failed",
                      reason: data.route.walletConnected
                        ? "No live probes were needed for this preview."
                        : "Connect a wallet to run live route probes.",
                    },
                  ]).map((probe) => (
                <div
                  key={`${probe.amountUsd}-${probe.status}`}
                  className="rounded-2xl border px-3 py-3"
                  style={{
                    borderColor:
                      probe.status === "routable"
                        ? "color-mix(in srgb, var(--accent) 38%, transparent)"
                        : probe.status === "failed"
                          ? "color-mix(in srgb, var(--down) 28%, transparent)"
                          : "var(--border-subtle)",
                    background: "var(--bg-base)",
                  }}
                >
                  <p className="font-mono text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                    ${probe.amountUsd}
                  </p>
                  <p
                    className="mt-1 font-body text-[10px] uppercase tracking-[0.14em]"
                    style={{
                      color:
                        probe.status === "routable"
                          ? "var(--up)"
                          : probe.status === "failed"
                            ? "var(--down)"
                            : "var(--text-3)",
                    }}
                  >
                    {probe.status}
                  </p>
                  <p className="mt-2 font-body text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                    {probe.reason ?? "Route built cleanly in preview."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
            <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              Resolution risk
            </p>
            <p className="mt-2 font-heading text-lg tracking-[-0.02em]" style={{ color: "var(--text-1)" }}>
              {data.risk.resolution.label}
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              {data.risk.resolution.summary}
            </p>
          </div>
          <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
            <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              Field risk
            </p>
            <p className="mt-2 font-heading text-lg tracking-[-0.02em]" style={{ color: "var(--text-1)" }}>
              {data.risk.field.label}
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              {data.risk.field.summary}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <CompactMarketStat label="Leader gap" value={`${data.risk.field.leaderGapPct.toFixed(1)}%`} />
              <CompactMarketStat label="Top 3 share" value={`${data.risk.field.topThreeSharePct.toFixed(1)}%`} />
            </div>
          </div>
          <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
            <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
              Siren take
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              {data.route.actionable}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatUsdCompact(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatEventCloseTime(value?: string | null): string {
  if (!value) return "Open";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Open";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

function JupiterPredictionMapPanel({ market }: { market: SelectedMarket }) {
  const { data, isLoading, isError } = useJupiterPredictionMap({
    title: market.title,
    outcomeLabel: market.selected_outcome_label ?? null,
  });

  if (isLoading) {
    return (
      <section
        className="mb-5 overflow-hidden rounded-[22px] border"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
      >
        <div className="flex items-center gap-3 px-5 py-4">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
            Mapping related Jupiter prediction markets...
          </p>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return null;
  }

  return (
    <section
      className="mb-5 overflow-hidden rounded-[22px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--polymarket) 10%, transparent), transparent 36%), linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
      }}
    >
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
              Jupiter prediction map
            </p>
            <h3 className="mt-2 font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
              Cross-venue read for this market thesis
            </h3>
          </div>
          <span
            className="rounded-full border px-3 py-1 font-body text-[10px] uppercase tracking-[0.14em]"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)", background: "var(--bg-base)" }}
          >
            Query: {data.query || market.title}
          </span>
        </div>

        <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          Siren can now pull Jupiter’s prediction directory into the market read, so we can compare how the same narrative is expressed across Kalshi and Polymarket before we chase size.
        </p>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {data.providers.map((provider) => (
            <div
              key={provider.provider}
              className="rounded-[20px] border p-4"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                    {provider.provider}
                  </p>
                  <p className="mt-1 font-heading text-lg" style={{ color: "var(--text-1)" }}>
                    {provider.events.length > 0 ? `${provider.events.length} related events` : "No obvious matches"}
                  </p>
                </div>
                <CompactMarketStat
                  label="Mapped"
                  value={String(provider.events.reduce((sum, event) => sum + event.marketCount, 0))}
                />
              </div>

              {provider.events.length === 0 ? (
                <p className="mt-4 font-body text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                  Jupiter did not surface a strong match yet for this exact query, which usually means the thesis is still venue-specific or phrased differently elsewhere.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {provider.events.slice(0, 2).map((event) => (
                    <div
                      key={event.eventId}
                      className="rounded-2xl border px-4 py-3"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-body text-sm leading-snug" style={{ color: "var(--text-1)" }}>
                            {event.title}
                          </p>
                          {event.subtitle && (
                          <p className="mt-1 font-body text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                              {event.subtitle}
                            </p>
                          )}
                          {event.eventUrl && (
                            <a
                              href={event.eventUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 font-body text-[11px] underline decoration-transparent transition-colors hover:decoration-current"
                              style={{ color: "var(--accent)" }}
                            >
                              Open venue
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs tabular-nums" style={{ color: "var(--text-2)" }}>
                            {formatUsdCompact(event.volumeUsd)}
                          </p>
                          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: event.isLive ? "var(--up)" : "var(--text-3)" }}>
                            {event.isLive ? "Live" : "Watching"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <CompactMarketStat label="Markets" value={String(event.marketCount)} />
                        <CompactMarketStat label="Closes" value={formatEventCloseTime(event.closeTime)} />
                        <CompactMarketStat label="Series" value={event.series || provider.provider} />
                      </div>

                      {event.markets.length > 0 && (
                        <div className="mt-3 grid gap-2">
                          {event.markets.slice(0, 2).map((child) => (
                            <div
                              key={child.marketId}
                              className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3"
                              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
                            >
                              <div className="min-w-0">
                                <p className="font-body text-[11px] leading-snug" style={{ color: "var(--text-1)" }}>
                                  {child.title}
                                </p>
                                <p className="mt-1 font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                                  {child.status}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono text-xs tabular-nums" style={{ color: "var(--accent)" }}>
                                  YES {formatUsdCompact(child.yesPriceUsd)}
                                </p>
                                <p className="mt-1 font-mono text-[11px] tabular-nums" style={{ color: "var(--text-3)" }}>
                                  Vol {formatUsdCompact(child.volume)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PredictionMarketFocusPanel({
  market,
  onPrimaryAction,
  onOpenVenue,
  onSelectOutcome,
  onShareCard,
  onDownloadCard,
  exportingCard,
}: {
  market: SelectedMarket;
  onPrimaryAction: () => void;
  onOpenVenue: () => void;
  onSelectOutcome: (ticker: string) => void;
  onShareCard: () => void;
  onDownloadCard: () => void;
  exportingCard: boolean;
}) {
  const { data: marketActivity } = useMarketActivity(market.source === "kalshi" ? market.ticker : undefined);
  const canTradeInSiren = canTradeSelectedMarketInSiren(market);
  const selectedOutcomeLabel = getSelectedOutcomeLabel(market);
  const multiOutcome = !!(market.outcomes && market.outcomes.length > 1);
  const sortedOutcomes = multiOutcome ? [...market.outcomes!].sort((a, b) => b.probability - a.probability) : [];

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
            {multiOutcome
              ? "Select the outcome you want routed, then size YES on that contract or fade it with NO."
              : "Size YES or NO with execution-aware routing. Kalshi outcomes via DFlow; Polymarket via your linked wallet when available."}
          </p>

          {multiOutcome && (
            <div className="mt-4 rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                  Outcome field
                </p>
                <p className="font-body text-xs" style={{ color: "var(--accent)" }}>
                  {selectedOutcomeLabel ? `Routing ${selectedOutcomeLabel}` : "Choose a route target"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sortedOutcomes.slice(0, 10).map((outcome) => {
                  const isActive = outcome.ticker === market.ticker;
                  return (
                    <button
                      key={outcome.ticker ?? outcome.label}
                      type="button"
                      onClick={() => outcome.ticker && onSelectOutcome(outcome.ticker)}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 font-body text-[11px] font-medium transition-colors"
                      style={{
                        borderColor: isActive
                          ? "color-mix(in srgb, var(--accent) 42%, transparent)"
                          : "var(--border-subtle)",
                        background: isActive
                          ? "color-mix(in srgb, var(--accent) 10%, var(--bg-surface))"
                          : "var(--bg-surface)",
                        color: isActive ? "var(--text-1)" : "var(--text-2)",
                      }}
                    >
                      <span className="max-w-[16ch] truncate">{outcome.label}</span>
                      <span className="font-mono font-semibold" style={{ color: "var(--accent)" }}>
                        {outcome.probability.toFixed(1)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CompactMarketStat
              label={multiOutcome && selectedOutcomeLabel ? selectedOutcomeLabel : "YES"}
              value={formatCentsFromProbability(market.probability, "yes")}
              tone="var(--accent)"
            />
            <CompactMarketStat
              label={multiOutcome && selectedOutcomeLabel ? `NOT ${selectedOutcomeLabel}` : "NO"}
              value={formatCentsFromProbability(market.probability, "no")}
              tone="var(--down)"
            />
            <CompactMarketStat label="Closes" value={formatTimestampLabel(market.close_time)} />
            <CompactMarketStat
              label={market.source === "kalshi" ? "Trades 24h" : "Liquidity"}
              value={
                market.source === "kalshi"
                  ? formatTradeCount(marketActivity?.tradeCount24h)
                  : formatCompactNumber(market.liquidity, 1)
              }
            />
          </div>
        </div>

        <div
          className="self-start rounded-[20px] border p-4"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
            background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 92%, transparent), var(--bg-surface))",
          }}
        >
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
            Actions
          </p>
          <p className="mt-1 font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
            {multiOutcome ? "Route the selected outcome in-terminal or open the venue for the full event book." : "Trade in-terminal or open the venue for research and context."}
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

          <div className="mt-4 grid gap-2">
            <div className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
              <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                Route target
              </p>
              <p className="mt-1 font-body text-sm" style={{ color: "var(--text-1)" }}>
                {selectedOutcomeLabel || "Primary yes contract"}
              </p>
            </div>
            <div className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
              <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                Venue context
              </p>
              <p className="mt-1 font-body text-sm" style={{ color: "var(--text-1)" }}>
                {market.source === "kalshi" ? "Kalshi event book" : "Polymarket order book"}
              </p>
            </div>
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
  const { selectedMarket, selectedSignal, setBuyPanelOpen, setSelectedMarketOutcome } = useSirenStore();
  const { publicKey, evmAddress } = useSirenWallet();
  const [exportingCard, setExportingCard] = useState(false);
  const [cardDisplayName, setCardDisplayName] = useState("@siren");
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const fontEmbedCssRef = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();

  const addToast = useToastStore((s) => s.addToast);
  const walletKey = publicKey?.toBase58();

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
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <>
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
                onSelectOutcome={(ticker) => {
                  hapticLight();
                  setSelectedMarketOutcome(ticker);
                }}
                onShareCard={() => exportSelectedMarket("share")}
                onDownloadCard={() => exportSelectedMarket("download")}
                exportingCard={exportingCard}
              />
              <ExecutionIntelligencePanel market={selectedMarket} />
              <ExecutionPreviewPanel market={selectedMarket} walletKey={walletKey} />
              <JupiterPredictionMapPanel market={selectedMarket} />
            </>
          </motion.div>
        ) : selectedMarket && compactMode ? (
          <motion.div
            key={`mc-${selectedMarket.ticker}`}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
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
              onSelectOutcome={(ticker) => {
                hapticLight();
                setSelectedMarketOutcome(ticker);
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
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SignalNarrativePanel signal={selectedSignal} />
          </motion.div>
        ) : (
          <motion.div
            key="surface-empty"
            className="mb-4 overflow-hidden rounded-[22px] border"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border-subtle))",
              background:
                "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 38%), linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
            }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.99 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-5 py-5">
              <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                Execution surface
              </p>
              <p className="mt-2 font-heading text-[1.05rem] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-1)" }}>
                Select a market to trade
              </p>
              <p className="mt-1 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                Choose an event from the market rail to load outcomes, routing context, and portfolio-aware actions.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
                  <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                    Tip
                  </p>
                  <p className="mt-2 font-body text-sm" style={{ color: "var(--text-2)" }}>
                    Use the <span className="font-semibold" style={{ color: "var(--text-1)" }}>Live movers</span> strip to jump straight to what’s moving.
                  </p>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
                  <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                    Shortcut
                  </p>
                  <p className="mt-2 font-body text-sm" style={{ color: "var(--text-2)" }}>
                    Search by <span className="font-semibold" style={{ color: "var(--text-1)" }}>question</span> or <span className="font-semibold" style={{ color: "var(--text-1)" }}>ticker</span> to route faster.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
