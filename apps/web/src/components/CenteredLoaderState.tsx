"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export function CenteredLoaderState({
  title,
  detail,
  phrases,
}: {
  title: string;
  detail: string;
  phrases?: string[];
}) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const activePhrase = phrases?.length ? phrases[phraseIndex % phrases.length] : null;

  useEffect(() => {
    if (!phrases?.length || phrases.length < 2) return;
    const timer = window.setInterval(() => {
      setPhraseIndex((index) => (index + 1) % phrases.length);
    }, 1900);
    return () => window.clearInterval(timer);
  }, [phrases]);

  return (
    <div
      className="mx-auto flex min-h-[46vh] w-full items-center justify-center px-4 py-8"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="w-full max-w-md rounded-[28px] border px-6 py-7 text-left"
        style={{
          borderColor: "var(--border-subtle)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 97%, transparent), color-mix(in srgb, var(--bg-base) 92%, transparent))",
          boxShadow: "0 24px 60px -44px rgba(0,0,0,0.45)",
        }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border" style={{ borderColor: "color-mix(in srgb, var(--accent) 24%, var(--border-subtle))", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-surface))" }}>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
        <p className="mt-5 font-heading text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--accent)" }}>
          Live feed
        </p>
        <p className="mt-2 font-heading text-[1.45rem] font-bold leading-[1.08]" style={{ color: "var(--text-1)" }}>
          {title}
        </p>
        {activePhrase && (
          <p className="mt-3 font-body text-sm font-medium leading-relaxed" style={{ color: "var(--accent)" }}>
            {activePhrase}
          </p>
        )}
        <p className={`${activePhrase ? "mt-2" : "mt-3"} font-body text-sm leading-[1.6]`} style={{ color: "var(--text-2)" }}>
          {detail}
        </p>
      </div>
    </div>
  );
}
