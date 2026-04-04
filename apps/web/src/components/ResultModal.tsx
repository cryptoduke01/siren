"use client";

import { CheckCircle, XCircle, ExternalLink, Info, Share2 } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import type { TradePnLSharePayload } from "@/store/useTradePnLShareStore";
import { useTradePnLShareStore } from "@/store/useTradePnLShareStore";

export function ResultModal({
  type,
  title,
  message,
  onClose,
  txSignature,
  txExplorer,
  actionLabel,
  actionHref,
  sharePnL,
}: {
  type: "success" | "error" | "info";
  title: string;
  message: string;
  onClose: () => void;
  txSignature?: string;
  txExplorer?: "polygon" | "base" | "solscan";
  actionLabel?: string;
  actionHref?: string;
  sharePnL?: TradePnLSharePayload;
}) {
  const openPnLShare = useTradePnLShareStore((s) => s.open);
  const Icon = type === "success" ? CheckCircle : type === "error" ? XCircle : Info;
  const color = type === "success" ? "var(--up)" : type === "error" ? "var(--down)" : "var(--accent)";
  const txHref = (() => {
    if (!txSignature) return null;
    if (txSignature.startsWith("0x")) {
      if (txExplorer === "polygon") return `https://polygonscan.com/tx/${txSignature}`;
      if (txExplorer === "base") return `https://basescan.org/tx/${txSignature}`;
      return `https://basescan.org/tx/${txSignature}`;
    }
    return `https://solscan.io/tx/${txSignature}`;
  })();
  const txLabel =
    txExplorer === "polygon"
      ? "View on Polygonscan"
      : txSignature?.startsWith("0x")
        ? "View on BaseScan"
        : "View on Solscan";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4 backdrop-blur-[2px]"
      style={{ background: "rgba(6,6,9,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] rounded-2xl border p-6 text-center shadow-xl max-h-[82vh] overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 0 0 1px var(--border-subtle), 0 24px 48px -12px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className="w-14 h-14 mx-auto mb-4" style={{ color }} strokeWidth={1.5} />
        <p className="font-heading font-semibold text-base mb-1.5" style={{ color: "var(--text-1)" }}>
          {title}
        </p>
        <div className="mb-5 max-h-[40vh] overflow-y-auto pr-1">
          <p className="font-body text-[13px] leading-relaxed break-words whitespace-pre-wrap text-left" style={{ color: "var(--text-2)" }}>
            {message}
          </p>
        </div>
        {txSignature && txHref && (
          <a
            href={txHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-body text-sm font-medium mb-3 transition-colors hover:opacity-90"
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
            }}
          >
            {txLabel}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {actionLabel && actionHref && (
          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-body text-sm font-medium mb-3 transition-colors hover:opacity-90"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-1)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {actionLabel}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {type === "success" && sharePnL && (
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
              openPnLShare(sharePnL);
            }}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-heading text-sm font-semibold mb-3 transition-colors hover:opacity-95"
            style={{
              background: "var(--accent)",
              color: "var(--accent-text)",
            }}
          >
            <Share2 className="w-4 h-4" />
            Share PnL card
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-body text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-1)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
