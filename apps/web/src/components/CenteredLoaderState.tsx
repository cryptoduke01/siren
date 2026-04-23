"use client";

import { Loader2 } from "lucide-react";

export function CenteredLoaderState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div
      className="mx-auto flex min-h-[46vh] w-full items-center justify-center px-4 py-8"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="w-full max-w-md rounded-[28px] border px-6 py-7 text-center"
        style={{
          borderColor: "var(--border-subtle)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 97%, transparent), color-mix(in srgb, var(--bg-base) 92%, transparent))",
          boxShadow: "0 24px 60px -44px rgba(0,0,0,0.45)",
        }}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border" style={{ borderColor: "color-mix(in srgb, var(--accent) 24%, var(--border-subtle))", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-surface))" }}>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
        <p className="mt-5 font-heading text-xl font-semibold tracking-[-0.05em]" style={{ color: "var(--text-1)" }}>
          {title}
        </p>
        <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          {detail}
        </p>
      </div>
    </div>
  );
}
