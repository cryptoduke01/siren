"use client";

import { CheckCircle, XCircle, ExternalLink } from "lucide-react";

export function ResultModal({
  type,
  title,
  message,
  onClose,
  txSignature,
  actionLabel,
  actionHref,
}: {
  type: "success" | "error";
  title: string;
  message: string;
  onClose: () => void;
  txSignature?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  const Icon = type === "success" ? CheckCircle : XCircle;
  const color = type === "success" ? "var(--up)" : "var(--down)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-[2px]"
      style={{ background: "rgba(6,6,9,0.85)" }}
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
        {txSignature && (
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-body text-sm font-medium mb-3 transition-colors hover:opacity-90"
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
            }}
          >
            View on Solscan
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
