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
  marketLabel?: string;
  positionLabel?: string;
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

export function TradePnLCard({
  token,
  profitUsd,
  percent,
  kalshiMarket,
  marketLabel: marketLabelProp,
  positionLabel: positionLabelProp,
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
  const contractLabel = useMemo(() => {
    const explicit = positionLabelProp?.trim();
    if (explicit) return explicit;
    const symbol = token.symbol?.trim();
    const name = token.name?.trim();
    if (symbol && symbol.length > 0) return symbol;
    if (name && name.length > 0) return name;
    return "Position";
  }, [positionLabelProp, token.name, token.symbol]);
  const marketLabel = useMemo(() => {
    const explicit = marketLabelProp?.trim();
    if (explicit) return explicit;
    const primary = kalshiMarket?.trim();
    if (primary) return primary;
    const fallback = token.name?.trim();
    return fallback && fallback.length > 0 ? fallback : "Prediction market position";
  }, [kalshiMarket, marketLabelProp, token.name]);

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
  const handleLabel = useMemo(() => {
    if (!displayName) return null;
    return displayName.startsWith("@") ? displayName : `@${displayName}`;
  }, [displayName]);

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: `rgba(${accentRgb},0.12)` }}
              >
                <span className="font-heading text-sm font-bold" style={{ color: accentHex }}>
                  SR
                </span>
              </div>
              <div>
                <p className="font-heading text-sm font-bold" style={{ color: "#F5F5F7" }}>
                  Siren PnL
                </p>
                <p className="font-body text-[11px]" style={{ color: "#6B6B80" }}>
                  Basic position snapshot
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

          <div
            className="mt-4 rounded-lg border px-3.5 py-3"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: "#6B6B80" }}>
                  Market
                </p>
                <p className="mt-1 font-heading text-sm font-semibold leading-snug" style={{ color: "#F5F5F7" }}>
                  {marketLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: "#6B6B80" }}>
                  Position
                </p>
                <p className="mt-1 font-money text-xs font-semibold tabular-nums" style={{ color: "#B8B8CC" }}>
                  {contractLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: "#6B6B80" }}>
                Entry
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
                Return
              </p>
              <p className="mt-0.5 font-money text-sm font-semibold tabular-nums" style={{ color: accentHex }}>
                {percent >= 0 ? "+" : ""}{percent.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <img src="/brand/mark.svg" alt="Siren" className="h-5 w-auto" style={{ filter: "brightness(1.1)" }} />
              <span className="font-heading text-xs font-bold" style={{ color: "#F5F5F7" }}>SIREN</span>
              {handleLabel && (
                <span className="font-body text-[10px]" style={{ color: "#6B6B80" }}>
                  {handleLabel}
                </span>
              )}
            </div>
            <div className="text-right">
              {dateLabel && (
                <p className="font-body text-[10px]" style={{ color: "#6B6B80" }}>
                  {dateLabel}
                </p>
              )}
              <p className="font-body text-[10px]" style={{ color: accentHex }}>
                onsiren.xyz
              </p>
            </div>
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
    </div>
  );
}
