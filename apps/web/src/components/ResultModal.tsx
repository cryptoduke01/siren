"use client";

import { CheckCircle, XCircle, ExternalLink } from "lucide-react";

export function ResultModal({
  type,
  title,
  message,
  onClose,
  txSignature,
}: {
  type: "success" | "error";
  title: string;
  message: string;
  onClose: () => void;
  txSignature?: string;
}) {
  const Icon = type === "success" ? CheckCircle : XCircle;
  const color = type === "success" ? "var(--bags)" : "var(--down)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border p-6 text-center"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className="w-12 h-12 mx-auto mb-3" style={{ color }} strokeWidth={1.5} />
        <p className="font-heading font-semibold text-sm mb-1" style={{ color: "var(--text-1)" }}>{title}</p>
        <p className="font-body text-xs mb-4" style={{ color: "var(--text-2)" }}>{message}</p>
        {txSignature && (
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg font-body text-sm font-medium mb-2"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)" }}
          >
            View on Solscan
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded-lg font-body text-sm font-medium"
          style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-subtle)" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
