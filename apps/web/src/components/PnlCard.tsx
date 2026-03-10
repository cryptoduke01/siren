"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import { ArrowUpRight, Eye, X, Share2, Download } from "lucide-react";
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
}

interface PnlCardProps {
  totalPnlUsd: number | null;
  totalPnlPercent: number | null;
  positions: PnlPosition[];
  walletAddress?: string | null;
  isLoading?: boolean;
}

const SAMPLE_PROFIT: PnlPosition = {
  ticker: "INX",
  title: "Bitcoin $150K by 2025",
  side: "yes",
  kalshiMarket: "Kalshi: INX",
  valueUsd: 847.5,
  pnlUsd: 127.25,
  pnlPercent: 17.7,
};

const SAMPLE_LOSS: PnlPosition = {
  ticker: "ETHX",
  title: "Ethereum $5K NO",
  side: "no",
  kalshiMarket: "Kalshi: ETHX",
  valueUsd: 312,
  pnlUsd: -84.2,
  pnlPercent: -12.3,
};

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

export function PnlCard({
  totalPnlUsd,
  totalPnlPercent,
  positions,
  walletAddress,
  isLoading,
}: PnlCardProps) {
  const [sampleMode, setSampleMode] = useState<"profit" | "loss" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const isSample = sampleMode !== null;
  const displayPositions = isSample
    ? [sampleMode === "profit" ? SAMPLE_PROFIT : SAMPLE_LOSS]
    : positions;
  const selected = displayPositions[selectedIndex] ?? displayPositions[0];

  const pnlUsd = selected?.pnlUsd ?? totalPnlUsd;
  const pnlPercent = selected?.pnlPercent ?? totalPnlPercent;
  const hasPnl = pnlUsd !== null && pnlUsd !== 0;
  const isPositive = pnlUsd != null && pnlUsd > 0;
  const hasShareableContent = isSample || positions.length > 0;

  const handleExport = (asShare: boolean) => async () => {
    if (!cardRef.current || !hasShareableContent) return;
    hapticLight();
    setExporting(true);
    try {
      await document.fonts.ready;
      await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0F0F18",
        skipFonts: false,
      });
      await new Promise((r) => setTimeout(r, 100));
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0F0F18",
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
        a.click();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Export failed", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={hasShareableContent ? cardRef : undefined}
        className="rounded-lg overflow-visible relative font-body"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 1px 0 0 rgba(0,255,133,0.06)",
          minWidth: 320,
          maxWidth: 380,
        }}
      >
        {isSample && (
          <div
            className="absolute top-3 right-3 z-10 flex items-center gap-2 px-2.5 py-1 rounded"
            style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)" }}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--accent)" }}>
              Sample
            </span>
            <button type="button" onClick={() => { hapticLight(); setSampleMode(null); }} className="p-0.5 rounded hover:bg-white/10" aria-label="Close">
              <X className="w-3 h-3" style={{ color: "var(--accent)" }} />
            </button>
          </div>
        )}

        {/* Top: P&L SUMMARY + wallet */}
        <div className="px-4 pt-4 pb-2">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--kalshi)" }}>
            P&L Summary
          </span>
          {walletAddress && (
            <span className="font-mono text-[10px] ml-2" style={{ color: "var(--text-3)" }}>
              {truncateAddress(walletAddress)}
            </span>
          )}
        </div>

        {/* Main PnL + mascot (right beside it, no background) */}
        <div className="px-4 pb-2 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="font-mono text-2xl font-bold tabular-nums"
              style={{
                color: hasPnl ? (isPositive ? "var(--up)" : "var(--down)") : "var(--text-3)",
              }}
            >
              {formatPnl(pnlUsd)}
            </span>
            {pnlPercent != null && (
              <span
                className="font-mono text-sm tabular-nums"
                style={{
                  color: hasPnl ? (isPositive ? "var(--up)" : "var(--down)") : "var(--text-3)",
                }}
              >
                {formatPercent(pnlPercent)}
              </span>
            )}
          </div>
        </div>

        {/* Token from Kalshi market */}
        {selected && (
          <div className="px-4 pb-3">
            <p className="font-heading text-sm" style={{ color: "var(--text-1)" }}>{selected.title}</p>
            {selected.kalshiMarket && (
              <p className="font-body text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                {selected.kalshiMarket}
              </p>
            )}
          </div>
        )}

        {/* Download + Share + Logo + URL */}
        <div
          className="px-4 py-3 flex flex-col gap-3"
          style={{ background: "var(--bg-base)", borderTop: "1px solid var(--border-subtle)" }}
        >
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport(false)}
              disabled={exporting}
              className="flex-1 py-2.5 rounded-lg font-heading font-semibold text-sm uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-subtle)" }}
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              type="button"
              onClick={handleExport(true)}
              disabled={exporting}
              className="flex-1 py-2.5 rounded-lg font-heading font-semibold text-sm uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
          <div className="flex items-center justify-between">
            <img src="/brand/mark.svg" alt="Siren" className="h-5 w-auto" />
            <span className="font-mono text-xs" style={{ color: "var(--accent)" }}>onsiren.xyz</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!hasShareableContent ? (
          <>
            <button
              type="button"
              onClick={() => { hapticLight(); setSampleMode("profit"); }}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
            >
              <Eye className="w-4 h-4" />
              Sample profit
            </button>
            <button
              type="button"
              onClick={() => { hapticLight(); setSampleMode("loss"); }}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
            >
              <Eye className="w-4 h-4" />
              Sample loss
            </button>
            <Link
              href="/"
              onClick={() => hapticLight()}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Go to Terminal
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </>
        ) : (
          positions.length === 0 && (
            <>
              <button
                type="button"
                onClick={() => { hapticLight(); setSampleMode("profit"); }}
                className="text-xs py-2 px-3 rounded-lg"
                style={{ color: "var(--text-3)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
              >
                Sample profit
              </button>
              <button
                type="button"
                onClick={() => { hapticLight(); setSampleMode("loss"); }}
                className="text-xs py-2 px-3 rounded-lg"
                style={{ color: "var(--text-3)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
              >
                Sample loss
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}
