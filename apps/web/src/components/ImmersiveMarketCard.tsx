"use client";

import { BarChart2, Users } from "lucide-react";
import type { MarketWithVelocity } from "@siren/shared";
import {
  inferMarketCategory,
  marketCategoryBadgeStyle,
  marketCategoryLabel,
  tickerHue,
} from "@/lib/marketFeedFilters";

function formatCompact(value?: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatCloseLine(m: MarketWithVelocity): string {
  if (!m.close_time || m.close_time <= Date.now()) return "";
  const d = new Date(m.close_time);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SourceMini({ source }: { source?: string }) {
  if (source === "polymarket") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-body text-[9px] font-semibold tracking-[0.12em]"
        style={{
          background: "color-mix(in srgb, var(--polymarket) 14%, var(--bg-surface))",
          color: "var(--polymarket)",
          border: "1px solid color-mix(in srgb, var(--polymarket) 28%, transparent)",
        }}
      >
        <img src="/brand/polymarket/icon-white.svg" alt="" className="h-2.5 w-2.5 opacity-90" />
        Polymarket
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-body text-[9px] font-semibold tracking-[0.12em]"
      style={{
        background: "color-mix(in srgb, var(--kalshi) 14%, var(--bg-surface))",
        color: "var(--kalshi)",
        border: "1px solid color-mix(in srgb, var(--kalshi) 28%, transparent)",
      }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--kalshi)" }} />
      Kalshi
    </span>
  );
}

/** Full-bleed market card for the terminal feed: gradient, outcomes, volume, primary CTA. */
export function ImmersiveMarketCard({
  market: m,
  isSelected,
  isHot,
  onSelect,
  layout = "feed",
}: {
  market: MarketWithVelocity;
  isSelected: boolean;
  isHot: boolean;
  onSelect: () => void;
  layout?: "feed" | "sheet";
}) {
  const yesPct = Math.min(100, Math.max(0, m.probability));
  const noPct = Math.min(100, Math.max(0, 100 - yesPct));
  const multi = m.outcomes && m.outcomes.length > 2;
  const sortedOutcomes = multi
    ? [...m.outcomes!].sort((a, b) => b.probability - a.probability)
    : [];
  const hue = tickerHue(m.ticker);
  const cat = inferMarketCategory(m);
  const pad = layout === "sheet" ? "p-3" : "p-3.5 sm:p-4";
  const canTradeInSiren = m.source === "kalshi" ? !!(m.yes_mint || m.no_mint) : !!(m.yes_token_id || m.no_token_id);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full text-left rounded-[22px] border overflow-hidden transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${layout === "feed" ? "motion-safe:active:scale-[0.99]" : ""}`}
      style={{
        borderColor: isSelected ? "color-mix(in srgb, var(--accent) 55%, transparent)" : "var(--border-subtle)",
        boxShadow: isSelected
          ? "0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent), 0 18px 40px -24px rgba(0,0,0,0.85)"
          : "0 14px 36px -28px rgba(0,0,0,0.75)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(145deg, color-mix(in srgb, hsl(${hue}, 72%, 34%) 12%, var(--bg-surface)) 0%, color-mix(in srgb, hsl(${(hue + 40) % 360}, 72%, 30%) 9%, var(--bg-base)) 56%, var(--bg-base) 100%)`,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="absolute -right-8 -bottom-10 w-40 h-40 rounded-full pointer-events-none blur-3xl opacity-25"
        style={{ background: `color-mix(in srgb, hsl(${hue}, 72%, 45%) 40%, transparent)` }}
      />

      <div className={`relative z-[1] ${pad} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {cat && (
            <span
              className="rounded-full px-2.5 py-0.5 font-heading text-[9px] font-bold uppercase tracking-[0.14em]"
              style={{ background: marketCategoryBadgeStyle(cat).bg, color: marketCategoryBadgeStyle(cat).color }}
            >
              {marketCategoryLabel(cat)}
            </span>
          )}
          {multi && (
            <span className="rounded-full px-2.5 py-0.5 font-body text-[9px] font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}>
              {m.outcomes!.length} options
            </span>
          )}
          {!multi && (
            <span
              className="rounded-full px-2.5 py-0.5 font-body text-[9px] font-semibold"
              style={{ background: "color-mix(in srgb, var(--bg-surface) 70%, transparent)", color: "var(--text-3)" }}
            >
              Yes / No
            </span>
          )}
          <SourceMini source={m.source} />
          {isHot && (
            <span className="font-heading text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--up)" }}>
              Live move
            </span>
          )}
        </div>

        <div>
          <h3
            className={`font-heading font-bold leading-[1.08] ${layout === "sheet" ? "text-[13px] line-clamp-2" : "text-[15px] sm:text-base md:text-[17px] line-clamp-3"}`}
            style={{ letterSpacing: "-0.035em", color: "var(--text-1)" }}
          >
            {m.title}
          </h3>
          {(m.subtitle || formatCloseLine(m)) && (
            <p className="mt-1 font-body text-[11px] leading-snug line-clamp-2" style={{ color: "var(--text-3)" }}>
              {[m.subtitle, formatCloseLine(m)].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {multi ? (
          <div className="flex flex-wrap gap-1.5">
            {sortedOutcomes.slice(0, 4).map((o, idx) => (
              <span
                key={o.ticker ?? `${o.label}-${idx}`}
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 font-body text-[10px] font-medium max-w-[100%]"
                style={{
                  background: "color-mix(in srgb, var(--bg-surface) 72%, transparent)",
                  color: "var(--text-2)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <span className="truncate max-w-[140px]">{o.label.length > 22 ? `${o.label.slice(0, 22)}…` : o.label}</span>
                <span className="font-mono font-bold shrink-0" style={{ color: "var(--accent)" }}>
                  {o.probability.toFixed(0)}%
                </span>
              </span>
            ))}
            {sortedOutcomes.length > 4 && (
              <span className="self-center font-heading text-[10px] font-bold pl-1" style={{ color: "var(--text-3)" }}>
                +{sortedOutcomes.length - 4} more
              </span>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:gap-2.5">
            <div
              className="flex-1 rounded-xl px-3 py-2.5 text-center"
              style={{ background: "color-mix(in srgb, var(--bg-surface) 70%, transparent)", border: "1px solid var(--border-subtle)" }}
            >
              <p className="font-heading text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-3)" }}>
                Yes
              </p>
              <p className="font-mono text-base md:text-[17px] font-bold tabular-nums" style={{ color: "var(--up)" }}>
                {yesPct.toFixed(0)}%
              </p>
            </div>
            <div
              className="flex-1 rounded-xl px-3 py-2.5 text-center"
              style={{ background: "color-mix(in srgb, var(--bg-surface) 70%, transparent)", border: "1px solid var(--border-subtle)" }}
            >
              <p className="font-heading text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-3)" }}>
                No
              </p>
              <p className="font-mono text-base md:text-[17px] font-bold tabular-nums" style={{ color: "var(--down)" }}>
                {noPct.toFixed(0)}%
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 font-body text-[10px]" style={{ color: "var(--text-3)" }}>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <BarChart2 className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
            ${formatCompact(m.volume ?? m.volume_24h)}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Users className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
            {formatCompact(m.liquidity ?? m.open_interest ?? m.volume_24h ?? 0)}
          </span>
        </div>

        <div
          className={`w-full rounded-2xl font-heading font-black uppercase tracking-[0.06em] text-center ${layout === "sheet" ? "py-2.5 text-[11px]" : "py-3 text-xs sm:text-[13px]"}`}
          style={{
            background: canTradeInSiren
              ? "color-mix(in srgb, var(--accent) 86%, var(--bg-surface))"
              : "color-mix(in srgb, var(--bg-surface) 88%, transparent)",
            color: canTradeInSiren ? "var(--accent-text)" : "var(--text-2)",
            boxShadow: canTradeInSiren
              ? "0 10px 28px -14px color-mix(in srgb, var(--accent) 65%, transparent)"
              : "none",
            border: canTradeInSiren ? "none" : "1px solid var(--border-subtle)",
          }}
        >
          {canTradeInSiren ? "Trade In Siren" : "Open Market"}
        </div>
      </div>
    </button>
  );
}
