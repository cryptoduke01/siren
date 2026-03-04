"use client";

import { useToastStore } from "@/store/useToastStore";

export function IssueBadge() {
  const toasts = useToastStore((s) => s.toasts);
  const errorCount = toasts.filter((t) => t.type === "error").length;
  if (errorCount === 0) return null;
  return (
    <div
      className="fixed left-4 bottom-4 z-30 font-mono text-[11px]"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--down)",
        borderRadius: 4,
        padding: "4px 10px",
        color: "var(--down)",
      }}
    >
      {errorCount} issue{errorCount !== 1 ? "s" : ""}
    </div>
  );
}
