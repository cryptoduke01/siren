"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import type { MarketCategoryId, MarketSourceFilter, MarketTimePreset } from "@/lib/marketFeedFilters";

export type MarketFeedSortMode = "hot" | "volume" | "newest" | "ending_soon";

const SORT_OPTIONS: { id: MarketFeedSortMode; label: string }[] = [
  { id: "hot", label: "Trending" },
  { id: "volume", label: "Volume" },
  { id: "newest", label: "Newest" },
  { id: "ending_soon", label: "Ending soon" },
];

const TIME_OPTIONS: { id: MarketTimePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "ending_soon", label: "Ending soon" },
  { id: "popular", label: "Popular" },
  { id: "all", label: "All time" },
];

const CATEGORY_OPTIONS: { id: MarketCategoryId; label: string; emoji: string }[] = [
  { id: "all", label: "All categories", emoji: "◆" },
  { id: "sports", label: "Sports", emoji: "◎" },
  { id: "politics", label: "Politics", emoji: "◇" },
  { id: "crypto", label: "Crypto", emoji: "₿" },
  { id: "finance", label: "Finance", emoji: "📈" },
  { id: "entertainment", label: "Entertainment", emoji: "✦" },
];

const SOURCE_OPTIONS: { id: MarketSourceFilter; label: string }[] = [
  { id: "all", label: "All venues" },
  { id: "kalshi", label: "Kalshi" },
  { id: "polymarket", label: "Polymarket" },
];

const ACCENT_ORANGE = "#ff7a18";

export function MarketFilterSheet({
  open,
  onClose,
  timePreset,
  setTimePreset,
  category,
  setCategory,
  source,
  setSource,
  sortMode,
  setSortMode,
}: {
  open: boolean;
  onClose: () => void;
  timePreset: MarketTimePreset;
  setTimePreset: (v: MarketTimePreset) => void;
  category: MarketCategoryId;
  setCategory: (v: MarketCategoryId) => void;
  source: MarketSourceFilter;
  setSource: (v: MarketSourceFilter) => void;
  sortMode: MarketFeedSortMode;
  setSortMode: (v: MarketFeedSortMode) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center md:p-6">
          <motion.button
            type="button"
            aria-label="Close filters"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px] md:bg-black/55"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0.98 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-[61] w-full max-h-[min(88vh,640px)] md:max-h-[82vh] md:max-w-[400px] flex flex-col rounded-t-[24px] md:rounded-[24px] border md:border shadow-2xl"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-subtle)",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <h2 className="font-heading text-sm font-black uppercase tracking-[0.12em]" style={{ color: "var(--text-1)" }}>
                Filter markets
              </h2>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onClose();
                }}
                className="h-9 w-9 rounded-full flex items-center justify-center border transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scrollbar-hidden">
              <section>
                <p className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-3)" }}>
                  Time
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TIME_OPTIONS.map((opt) => {
                    const active = timePreset === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setTimePreset(opt.id);
                        }}
                        className="rounded-xl py-3 px-2 font-heading text-[11px] font-bold uppercase tracking-wide transition-all"
                        style={{
                          background: active ? ACCENT_ORANGE : "var(--bg-elevated)",
                          color: active ? "#0a0a0a" : "var(--text-2)",
                          border: `1px solid ${active ? ACCENT_ORANGE : "var(--border-subtle)"}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <p className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-3)" }}>
                  Order {timePreset === "popular" ? "(using Popular)" : ""}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SORT_OPTIONS.map((opt) => {
                    const active = sortMode === opt.id;
                    const disabled = timePreset === "popular";
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          hapticLight();
                          setSortMode(opt.id);
                        }}
                        className="rounded-xl py-2.5 px-2 font-heading text-[10px] font-bold uppercase tracking-wide transition-all disabled:opacity-40"
                        style={{
                          background: active && !disabled ? "var(--bg-surface)" : "var(--bg-elevated)",
                          color: active && !disabled ? "var(--accent)" : "var(--text-3)",
                          border: `1px solid ${active && !disabled ? "var(--accent)" : "var(--border-subtle)"}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <p className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-3)" }}>
                  Categories
                </p>
                <ul className="space-y-2">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const active = category === opt.id;
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          onClick={() => {
                            hapticLight();
                            setCategory(opt.id);
                          }}
                          className="w-full flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-colors"
                          style={{
                            background: active ? "color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))" : "var(--bg-elevated)",
                            borderColor: active ? "color-mix(in srgb, var(--accent) 35%, transparent)" : "var(--border-subtle)",
                          }}
                        >
                          <span className="flex items-center gap-3">
                            <span className="text-lg w-6 text-center" aria-hidden>
                              {opt.emoji}
                            </span>
                            <span className="font-body text-sm font-medium" style={{ color: "var(--text-1)" }}>
                              {opt.label}
                            </span>
                          </span>
                          <span style={{ color: "var(--text-3)" }}>›</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section>
                <p className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-3)" }}>
                  Venue
                </p>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_OPTIONS.map((opt) => {
                    const active = source === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setSource(opt.id);
                        }}
                        className="rounded-full px-4 py-2 font-body text-xs font-semibold capitalize transition-all"
                        style={{
                          background: active ? ACCENT_ORANGE : "var(--bg-elevated)",
                          color: active ? "#0a0a0a" : "var(--text-2)",
                          border: `1px solid ${active ? ACCENT_ORANGE : "var(--border-subtle)"}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="flex-shrink-0 p-5 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onClose();
                }}
                className="w-full py-3.5 rounded-2xl font-heading text-sm font-black uppercase tracking-[0.08em]"
                style={{ background: ACCENT_ORANGE, color: "#0a0a0a" }}
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
