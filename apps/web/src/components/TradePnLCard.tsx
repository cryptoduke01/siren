"use client";

import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Download, Share2, Loader2 } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

export type TradePnLToken = {
  name: string;
  symbol: string;
};

export interface TradePnLCardProps {
  token: TradePnLToken;
  profitUsd: number;
  percent: number;
  kalshiMarket: string;
  wallet?: string | null;
  displayName?: string | null;
  showUSD?: boolean;
  /** Timestamp of the trade (used for "Closed on" line). */
  executedAt?: number | null;
}

function formatUsd(value: number, opts?: { compact?: boolean }) {
  const compact = opts?.compact ?? false;
  if (!Number.isFinite(value)) return "—";
  if (!compact) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}K`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "—";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(0)}%`;
}

function maskWallet(address?: string | null) {
  if (!address) return "";
  if (address.length < 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function TradePnLCard({
  token,
  profitUsd,
  percent,
  kalshiMarket,
  wallet,
  displayName,
  showUSD = true,
  executedAt,
}: TradePnLCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const isLoss = profitUsd < 0;
  const accent = isLoss ? "var(--down)" : "var(--up)";

  // Derive Bought/Value from Profit/Percent (assuming percent = profit / bought * 100)
  const { boughtUsd, valueUsd } = useMemo(() => {
    const safeProfit = Number.isFinite(profitUsd) ? profitUsd : 0;
    const safePercent = Number.isFinite(percent) ? percent : 0;
    if (!safePercent) return { boughtUsd: null as number | null, valueUsd: null as number | null };
    const bought = safeProfit / (safePercent / 100);
    if (!Number.isFinite(bought) || bought <= 0) return { boughtUsd: null, valueUsd: null };
    const value = bought + safeProfit;
    return { boughtUsd: bought, valueUsd: value };
  }, [profitUsd, percent]);

  const executedLabel = useMemo(() => {
    if (!executedAt) return "";
    try {
      const d = new Date(executedAt);
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [executedAt]);

  const profitLabel = useMemo(() => {
    const prefix = profitUsd >= 0 ? "+" : "-";
    return `${prefix}${formatUsd(Math.abs(profitUsd))}`;
  }, [profitUsd]);

  const handleExport = (asShare: boolean) => async () => {
    setExporting(true);
    try {
      if (!cardRef.current) return;
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 120));

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#050508",
        scale: 2,
        useCORS: true,
      });

      const dataUrl = canvas.toDataURL("image/png");

      // Always download for reliability; share is optional.
      if (!asShare) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `siren-pnl-${token.symbol}-${Date.now()}.png`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `siren-pnl-${token.symbol}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Siren PnL",
          text: "Trade predictions on Siren",
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `siren-pnl-${token.symbol}-${Date.now()}.png`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div
        ref={cardRef}
        className="relative w-full max-w-[420px] aspect-[4/3] overflow-hidden rounded-3xl border"
        style={{
          borderColor: "var(--border-subtle)",
          background: "radial-gradient(800px 500px at 0% 0%, rgba(0,255,133,0.20) 0%, rgba(0,0,0,0) 60%), linear-gradient(180deg, #07070b 0%, #040406 100%)",
        }}
      >
        {/* Decorative arc + triangle (lightweight CSS approximation of the design screenshot) */}
        <div
          className="pointer-events-none absolute -right-[18%] -top-[16%] w-[380px] h-[380px] rounded-full"
          style={{
            background: isLoss ? "rgba(255,69,96,0.18)" : "rgba(0,255,133,0.18)",
            filter: "blur(0px)",
          }}
        />
        <div
          className="pointer-events-none absolute right-[10%] top-[18%]"
          style={{
            width: 0,
            height: 0,
            borderLeft: "120px solid transparent",
            borderRight: "0px solid transparent",
            borderBottom: `120px solid rgba(${isLoss ? "255,69,96" : "0,255,133"},0.95)`,
            transform: "rotate(-20deg)",
            opacity: isLoss ? 0.7 : 0.95,
          }}
        />

        <div className="relative z-[2] h-full w-full p-6 flex flex-col">
          {/* Header: token */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <span className="font-heading font-bold text-lg" style={{ color: accent }}>
                  {token.symbol.slice(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-heading text-sm font-bold" style={{ color: "var(--text-1)", lineHeight: 1.1 }}>
                  ${token.symbol}
                </p>
                <p className="font-body text-xs" style={{ color: "var(--text-3)", marginTop: 2 }} title={token.name}>
                  {token.name.length > 18 ? `${token.name.slice(0, 18)}…` : token.name}
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl" style={{ background: isLoss ? "rgba(255,69,96,0.12)" : "rgba(0,255,133,0.12)" }} />
          </div>

          {/* Profit */}
          <div className="mt-10 flex flex-col">
            <p
              className="font-mono font-bold text-5xl tracking-tight tabular-nums"
              style={{ color: accent, textShadow: `0 0 22px rgba(${isLoss ? "255,69,96" : "0,255,133"},0.35)` }}
            >
              {profitLabel}
            </p>
            <p className="font-body text-xl font-bold mt-2" style={{ color: accent }}>
              PNL: {percent >= 0 ? "+" : "-"}{Math.abs(percent).toFixed(0)}%
            </p>
          </div>

          {/* Signal card */}
          <div className="mt-6 rounded-3xl border" style={{ borderColor: "var(--border-subtle)", background: "rgba(0,0,0,0.18)" }}>
            <div className="px-5 py-4">
              <p className="font-body text-xs uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
                Signal from Kalshi
              </p>
              <p className="font-heading text-2xl font-bold mt-2 leading-tight" style={{ color: "var(--text-1)" }}>
                {kalshiMarket}
              </p>
              <p className="font-body text-xs mt-2" style={{ color: "var(--text-3)" }}>
                (Optional: Market movement caused spike)
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-auto pt-5 grid grid-cols-3 gap-3 items-end">
            <div>
              <p className="font-body text-xs uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                Bought
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                {boughtUsd != null ? formatUsd(boughtUsd) : "—"}
              </p>
            </div>
            <div>
              <p className="font-body text-xs uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                Value
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: accent }}>
                {valueUsd != null ? formatUsd(valueUsd) : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-body text-xs uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                Closed on
              </p>
              <p className="font-body text-xs mt-2" style={{ color: "var(--text-2)" }}>
                {executedLabel || "—"}
              </p>
            </div>
          </div>

          {/* Footer brand */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/brand/mark.svg" alt="Siren" className="h-7 w-auto" style={{ filter: "brightness(1.1)" }} />
              <div>
                <span className="font-heading font-bold text-sm" style={{ color: "var(--text-1)" }}>
                  SIREN
                </span>
                {displayName && (
                  <p className="font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-3)" }}>
                    {displayName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
                TRADE ON SIREN:
              </span>
              <span className="font-mono text-[11px] px-3 py-1 rounded-full" style={{ background: "rgba(0,255,133,0.15)", color: accent }}>
                @onsiren.xyz
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[420px] flex gap-2">
        <button
          type="button"
          onClick={handleExport(false)}
          disabled={exporting}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 font-heading text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
          style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-subtle)" }}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download
        </button>
        <button
          type="button"
          onClick={handleExport(true)}
          disabled={exporting}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 font-heading text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Share
        </button>
      </div>

      {wallet && (
        <p className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
          Wallet: {maskWallet(wallet)}
        </p>
      )}
    </div>
  );
}
