"use client";

import { ShoppingBag, Zap, Dog, Rocket } from "lucide-react";
import type { LaunchpadId } from "@siren/shared";

const LAUNCHPAD_CONFIG: Record<
  LaunchpadId,
  { label: string; Icon: typeof ShoppingBag; color: string }
> = {
  bags: { label: "Bags", Icon: ShoppingBag, color: "var(--bags)" },
  pump: { label: "Pump", Icon: Zap, color: "#9945FF" },
  bonk: { label: "Bonk", Icon: Dog, color: "#F6B353" },
  moonshot: { label: "Moonshot", Icon: Rocket, color: "#E040FB" },
  other: { label: "Other", Icon: Rocket, color: "var(--text-3)" },
};

export function LaunchpadBadge({ launchpad }: { launchpad?: LaunchpadId | null }) {
  if (!launchpad || launchpad === "other") return null;
  const config = LAUNCHPAD_CONFIG[launchpad];
  if (!config) return null;
  const { label, Icon, color } = config;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] font-body font-medium text-[10px] uppercase"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        color,
      }}
      title={`Launched on ${label}`}
    >
      <Icon className="w-3 h-3 shrink-0" strokeWidth={2} />
      {label}
    </span>
  );
}
