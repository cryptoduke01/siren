"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import { ArrowUpRight, Share2, Download, ChevronLeft, ChevronRight, LogOut, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { hapticLight } from "@/lib/haptics";

export interface PnlPosition {
  ticker: string;
  title: string;
  side?: "yes" | "no";
  kalshiMarket?: string;
  valueUsd: number;
  pnlUsd: number | null;
  pnlPercent: number | null;
  /** Mint address for one-click sell (token or Kalshi prediction). */
  mint?: string;
}

interface PnlCardProps {
  totalPnlUsd: number | null;
  totalPnlPercent: number | null;
  positions: PnlPosition[];
  walletAddress?: string | null;
  displayName?: string | null;
  isLoading?: boolean;
  /** Called when user clicks sell for a position. Opens buy panel in sell mode. */
  onSell?: (position: PnlPosition) => void;
}

export function formatPnl(value: number | null): string {
  if (value === null) return "—";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function truncateAddress(addr: string, len = 6): string {
  if (!addr || addr.length < len * 2) return addr;
  return `${addr.slice(0, len)}…${addr.slice(-len)}`;
}

function maskPnl(): string {
  return "••••••";
}

function maskPercent(): string {
  return "••••";
}

export function PnlCard({
  totalPnlUsd,
  totalPnlPercent,
  positions,
  walletAddress,
  displayName,
  isLoading,
  onSell,
}: PnlCardProps) {
  const [exporting, setExporting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [privacy, setPrivacy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const displayPositions = positions;
  const positionCount = displayPositions.length;
  const activeIndex = positionCount > 0 ? selectedIndex % positionCount : 0;
  const selected = displayPositions[activeIndex] ?? displayPositions[0];

  const pnlUsd = selected?.pnlUsd ?? totalPnlUsd;
  const pnlPercent = selected?.pnlPercent ?? totalPnlPercent;
  const hasPnl = pnlUsd !== null && pnlUsd !== 0;
  const isLoss = pnlUsd != null && pnlUsd < 0;
  const hasShareableContent =
    positions.some((p) => (p.valueUsd ?? 0) > 0 || p.pnlUsd !== null || p.pnlPercent !== null);

  const accent = isLoss ? "var(--down)" : "var(--up)";
  const glowRgb = isLoss ? "255, 69, 96" : "0, 255, 133";

  const tokenLabel = selected?.title ?? "—";
  const isPredictionCard = selected?.side != null;
  const signalLine =
    selected == null
      ? ""
      : selected.side != null
        ? `${selected.side === "yes" ? "YES" : "NO"} · ${selected.kalshiMarket ?? `Kalshi · ${selected.ticker}`}`
        : `${selected.ticker} · spot`;

  const handleExport = (asShare: boolean) => async () => {
    setExportError(null);
    if (!hasShareableContent) {
      setExportError("Nothing to export yet — trade or hold a position first.");
      return;
    }
    if (!cardRef.current) {
      setExportError("Card is not ready. Refresh and try again.");
      return;
    }
    hapticLight();
    setExporting(true);
    try {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 120));
      const node = cardRef.current;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#000000",
        skipFonts: false,
      });
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const file = new File([blob], "siren-pnl.png", { type: "image/png" });
      if (asShare && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My Siren PnL",
          text: "Trade predictions on Siren",
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `siren-pnl-${Date.now()}.png`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.warn("Export failed", e);
      setExportError(
        msg.includes("taint") || msg.includes("security")
          ? "Export blocked by the browser (image security). Try again or use Chrome."
          : "Could not save the image. Try again, or use Download in Chrome."
      );
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="w-full max-w-[360px] aspect-square rounded-2xl animate-pulse"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="w-full min-w-0 max-w-[360px]">
        <div className="relative">
          {/* Privacy control sits outside export ref so it is not baked into PNG */}
          {hasShareableContent && (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setPrivacy((p) => !p);
              }}
              className="absolute right-3 top-3 z-20 rounded-lg p-2 transition-colors hover:bg-white/5"
              style={{ color: "var(--text-3)" }}
              title={privacy ? "Show amounts" : "Hide amounts"}
              aria-pressed={privacy}
            >
              {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}

          {/* Shareable square card (design: dynamic HTML; designer SVGs in /brand/pnl/*.svg) */}
          <div
            ref={cardRef}
            className="relative w-full aspect-square overflow-hidden rounded-2xl border font-body"
            style={{
              borderColor: "color-mix(in srgb, var(--border-subtle) 80%, transparent)",
              boxShadow: `0 0 0 1px rgba(${glowRgb}, 0.12), 0 24px 48px -16px rgba(0,0,0,0.5)`,
            }}
          >
          <div className="absolute inset-0 z-0 bg-black" aria-hidden />

          {/* Neutral grain only — full Figma SVGs use green→magenta gradients that screen-blend into purple bands over text */}
          <div
            className="pointer-events-none absolute inset-0 z-0 opacity-[0.07]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E")`,
              mixBlendMode: "overlay",
            }}
            aria-hidden
          />

          {/* Ambient glow (matches designer SVG: #00FF85 / loss red) */}
          <div
            className="absolute -bottom-[20%] left-1/2 h-[55%] w-[130%] -translate-x-1/2 rounded-[100%] opacity-35 blur-[72px]"
            style={{ background: `radial-gradient(ellipse at center, rgba(${glowRgb}, 0.55) 0%, transparent 68%)` }}
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              background: `radial-gradient(800px 400px at 80% 20%, rgba(${glowRgb}, 1) 0%, transparent 55%)`,
            }}
            aria-hidden
          />

          {/* Mascot — PNGs keyed to profit/loss; blend on dark bg */}
          <img
            src={isLoss ? "/brand/loss-mascot.png" : "/brand/profit-mascot.png"}
            alt=""
            className="pnl-mascot pointer-events-none absolute bottom-2 right-2 z-[1] h-[38%] max-h-[200px] w-auto object-contain select-none"
            style={{ objectFit: "contain" }}
          />

          <div className="relative z-[2] flex h-full flex-col p-5 pr-14 md:p-6 md:pr-16">
            <div className="min-w-0">
              <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
                {isPredictionCard ? "Prediction P&L" : "P&L snapshot"}
              </p>
              {walletAddress && (
                <p className="mt-1 font-mono text-[10px] tabular-nums" style={{ color: "var(--text-3)" }}>
                  {privacy ? "••••••••••••" : truncateAddress(walletAddress)}
                </p>
              )}
            </div>

            <div className="mt-6 min-w-0 flex-1">
              <p
                className="font-heading text-[clamp(1.75rem,7vw,2.75rem)] font-bold leading-tight tabular-nums tracking-tight"
                style={{ color: hasPnl ? accent : "var(--text-3)" }}
              >
                {privacy ? maskPnl() : formatPnl(pnlUsd)}
              </p>
              {(pnlPercent != null || privacy) && (
                <p
                  className="font-mono text-xl font-semibold tabular-nums md:text-2xl"
                  style={{ color: hasPnl ? accent : "var(--text-3)" }}
                >
                  {privacy ? maskPercent() : formatPercent(pnlPercent)}
                </p>
              )}
              <p
                className="mt-4 line-clamp-2 font-heading text-base font-semibold leading-snug md:text-lg"
                style={{ color: "var(--text-1)" }}
              >
                {privacy ? "••••••••••" : tokenLabel}
              </p>
              {signalLine && (
                <p className="mt-1 line-clamp-2 font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                  {privacy ? "•• • •••••• ••••" : signalLine}
                </p>
              )}
              {isPredictionCard && (
                <div
                  className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-heading font-semibold uppercase tracking-[0.14em]"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: accent,
                    border: `1px solid rgba(${glowRgb}, 0.28)`,
                  }}
                >
                  Marked to live market
                </div>
              )}
            </div>

            <div className="mt-auto flex items-end justify-between gap-3 pt-4">
              <div className="min-w-0">
                <img src="/brand/mark.svg" alt="Siren" className="h-6 w-auto opacity-95 md:h-7" />
                {displayName && (
                  <p className="mt-1 font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                    {displayName}
                  </p>
                )}
              </div>
              <span className="font-mono text-xs font-medium md:text-sm" style={{ color: accent }}>
                onsiren.xyz
              </span>
            </div>
          </div>
          </div>
        </div>

        {/* Controls: not part of PNG export */}
        {selected && displayPositions.length > 0 && (
          <div className="mt-3 space-y-3">
            {displayPositions.length > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setSelectedIndex((i) => (i - 1 + displayPositions.length) % displayPositions.length);
                  }}
                  className="rounded-lg p-1.5"
                  style={{ color: "var(--text-3)" }}
                  aria-label="Previous position"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--text-3)" }}>
                  {activeIndex + 1} / {displayPositions.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setSelectedIndex((i) => (i + 1) % displayPositions.length);
                  }}
                  className="rounded-lg p-1.5"
                  style={{ color: "var(--text-3)" }}
                  aria-label="Next position"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex justify-end">
              {onSell && selected.mint && (
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    onSell(selected);
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-[11px] font-medium transition-colors hover:opacity-90"
                  style={{
                    background: "color-mix(in srgb, var(--down) 16%, var(--bg-surface))",
                    color: "var(--down)",
                    border: "1px solid color-mix(in srgb, var(--down) 28%, transparent)",
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sell
                </button>
              )}
            </div>
          </div>
        )}

        <div
          className="mt-4 flex flex-col gap-3 rounded-xl border p-4"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
        >
          {exportError && (
            <p className="font-body text-xs leading-snug" style={{ color: "var(--down)" }}>
              {exportError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport(false)}
              disabled={exporting || !hasShareableContent}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-heading text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
              style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-subtle)" }}
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              type="button"
              onClick={handleExport(true)}
              disabled={exporting || !hasShareableContent}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-heading text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>
      </div>

      {!hasShareableContent && (
        <div className="flex max-w-[360px] flex-wrap items-center gap-2">
          <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
            Connect and trade to see P&amp;L.
          </p>
          <Link
            href="/terminal"
            onClick={() => hapticLight()}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            Go to Terminal
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
