"use client";

import { useState } from "react";
import type { LaunchpadId } from "@siren/shared";

const LAUNCHPAD_CONFIG: Record<LaunchpadId, { label: string; color: string; logoUrl: string; fallback: string }> = {
  bags: { label: "Bags", color: "var(--bags)", logoUrl: "/brand/mark.svg", fallback: "B" },
  pump: { label: "Pump", color: "#9945FF", logoUrl: "https://pump.fun/favicon.ico", fallback: "P" },
  bonk: { label: "Bonk", color: "#F6B353", logoUrl: "https://bonkbot.io/favicon.ico", fallback: "B" },
  moonshot: { label: "Moonshot", color: "#E040FB", logoUrl: "https://moonshot.money/favicon.ico", fallback: "M" },
  other: { label: "Other", color: "var(--text-3)", logoUrl: "", fallback: "O" },
};

export function LaunchpadBadge({ launchpad }: { launchpad?: LaunchpadId | null }) {
  if (!launchpad || launchpad === "other") return null;
  const config = LAUNCHPAD_CONFIG[launchpad];
  if (!config) return null;
  const { label, color, logoUrl, fallback } = config;
  const [imageErrored, setImageErrored] = useState(false);
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border font-body font-medium text-[10px] uppercase"
      style={{
        background: "color-mix(in srgb, var(--bg-elevated) 84%, transparent)",
        border: "1px solid color-mix(in srgb, var(--border-subtle) 65%, transparent)",
        color,
      }}
      title={`Launched on ${label}`}
    >
      <span
        className="w-4 h-4 rounded-full inline-flex items-center justify-center overflow-hidden border"
        style={{ borderColor: color, background: "var(--bg-surface)" }}
      >
        {logoUrl && !imageErrored ? (
          <img
            src={logoUrl}
            alt={label}
            className="w-full h-full object-cover"
            onError={() => setImageErrored(true)}
          />
        ) : null}
        <span className="text-[9px] leading-none" style={{ display: logoUrl && !imageErrored ? "none" : "inline" }}>
          {fallback}
        </span>
      </span>
      {label}
    </span>
  );
}
