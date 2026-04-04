"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
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
  executedAt?: number | null;
  /** When set with valueUsd, fills Bought / Value instead of deriving from percent. */
  stakeUsd?: number | null;
  valueUsd?: number | null;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  executedAt,
  stakeUsd: stakeUsdProp,
  valueUsd: valueUsdProp,
}: TradePnLCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const isProfit = profitUsd >= 0;
  const accentHex = isProfit ? "#00FF85" : "#FF4560";
  const accentRgb = isProfit ? "0,255,133" : "255,69,96";

  const { boughtUsd, valueUsd } = useMemo(() => {
    if (
      stakeUsdProp != null &&
      valueUsdProp != null &&
      Number.isFinite(stakeUsdProp) &&
      Number.isFinite(valueUsdProp) &&
      stakeUsdProp > 0
    ) {
      return { boughtUsd: stakeUsdProp, valueUsd: valueUsdProp };
    }
    const safeProfit = Number.isFinite(profitUsd) ? profitUsd : 0;
    const safePercent = Number.isFinite(percent) ? percent : 0;
    if (!safePercent) return { boughtUsd: null as number | null, valueUsd: null as number | null };
    const bought = safeProfit / (safePercent / 100);
    if (!Number.isFinite(bought) || bought <= 0) return { boughtUsd: null, valueUsd: null };
    return { boughtUsd: bought, valueUsd: bought + safeProfit };
  }, [profitUsd, percent, stakeUsdProp, valueUsdProp]);

  const dateLabel = useMemo(() => {
    if (!executedAt) return "";
    try {
      return new Date(executedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  }, [executedAt]);

  const handleExport = (asShare: boolean) => async () => {
    hapticLight();
    setExporting(true);
    try {
      if (!cardRef.current) return;
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 120));

      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#050508" });

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
        await navigator.share({ files: [file], title: "Siren PnL", text: "Trade predictions on Siren" });
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
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl"
        style={{
          background: "#0A0A0F",
          border: `1px solid rgba(${accentRgb},0.2)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 0% 0%, rgba(${accentRgb},0.12) 0%, transparent 70%)`,
          }}
        />

        <div className="relative z-[2] p-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: `rgba(${accentRgb},0.12)` }}
              >
                <span className="font-heading text-sm font-bold" style={{ color: accentHex }}>
                  {token.symbol.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-heading text-sm font-bold" style={{ color: "#F5F5F7" }}>
                  ${token.symbol}
                </p>
                <p className="font-body text-[11px]" style={{ color: "#6B6B80" }}>
                  {token.name.length > 24 ? `${token.name.slice(0, 24)}…` : token.name}
                </p>
              </div>
            </div>
            <div
              className="rounded-md px-2 py-1 font-money text-[11px] font-semibold tabular-nums"
              style={{ background: `rgba(${accentRgb},0.12)`, color: accentHex }}
            >
              {percent >= 0 ? "+" : ""}{percent.toFixed(1)}%
            </div>
          </div>

          {/* PnL */}
          <div className="mt-5">
            <p className="font-body text-[10px] uppercase tracking-[0.15em]" style={{ color: "#6B6B80" }}>
              Profit / Loss
            </p>
            <p
              className="mt-1 font-money text-3xl font-bold tabular-nums tracking-tight"
              style={{ color: accentHex }}
            >
              {profitUsd >= 0 ? "+" : "-"}{formatUsd(profitUsd)}
            </p>
          </div>

          {/* Market */}
          <div
            className="mt-4 rounded-lg border px-3.5 py-3"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}
          >
            <p className="font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: "#6B6B80" }}>
              Signal
            </p>
            <p className="mt-1 font-heading text-sm font-semibold leading-snug" style={{ color: "#F5F5F7" }}>
              {kalshiMarket}
            </p>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: "#6B6B80" }}>
                Bought
              </p>
              <p className="mt-0.5 font-money text-sm font-semibold tabular-nums" style={{ color: "#B8B8CC" }}>
                {boughtUsd != null ? formatUsd(boughtUsd) : "—"}
              </p>
            </div>
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: "#6B6B80" }}>
                Value
              </p>
              <p className="mt-0.5 font-money text-sm font-semibold tabular-nums" style={{ color: accentHex }}>
                {valueUsd != null ? formatUsd(valueUsd) : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: "#6B6B80" }}>
                {dateLabel ? "Date" : ""}
              </p>
              <p className="mt-0.5 font-body text-[11px]" style={{ color: "#6B6B80" }}>
                {dateLabel}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <img src="/brand/mark.svg" alt="Siren" className="h-5 w-auto" style={{ filter: "brightness(1.1)" }} />
              <span className="font-heading text-xs font-bold" style={{ color: "#F5F5F7" }}>SIREN</span>
              {displayName && (
                <span className="font-body text-[10px]" style={{ color: "#6B6B80" }}>
                  @{displayName}
                </span>
              )}
            </div>
            <span
              className="rounded-full px-2.5 py-1 font-sub text-[10px] font-medium"
              style={{ background: `rgba(${accentRgb},0.1)`, color: accentHex }}
            >
              onsiren.xyz
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-[420px] flex gap-2">
        <button
          type="button"
          onClick={handleExport(false)}
          disabled={exporting}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 font-heading text-xs font-semibold disabled:opacity-50"
          style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-subtle)" }}
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Download
        </button>
        <button
          type="button"
          onClick={handleExport(true)}
          disabled={exporting}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 font-heading text-xs font-semibold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
          Share
        </button>
      </div>

      {wallet && (
        <p className="font-sub text-[10px]" style={{ color: "var(--text-3)" }}>
          {maskWallet(wallet)}
        </p>
      )}
    </div>
  );
}
