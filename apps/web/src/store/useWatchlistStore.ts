import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Watchlist is persisted to localStorage (key: siren-watchlist) — survives refresh, new tabs, browser restarts.
 * Clearing site data will reset it. For cross-device sync, a backend (e.g. Supabase) would be needed. */
export type WatchlistMarketSnapshot = {
  ticker: string;
  title: string;
  probability: number;
  source?: string;
  subtitle?: string;
  closeTime?: number;
  selectedOutcomeLabel?: string;
  outcomeCount?: number;
};

function normalizeMarketTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

interface WatchlistState {
  hasHydrated: boolean;
  starredMarketTickers: string[];
  starredMarketsByTicker: Record<string, WatchlistMarketSnapshot>;
  starredTokenMints: string[];
  setHasHydrated: (hydrated: boolean) => void;
  starMarket: (ticker: string, snapshot?: WatchlistMarketSnapshot) => void;
  unstarMarket: (ticker: string) => void;
  isMarketStarred: (ticker: string) => boolean;
  getMarketSnapshot: (ticker: string) => WatchlistMarketSnapshot | null;
  starToken: (mint: string) => void;
  unstarToken: (mint: string) => void;
  isTokenStarred: (mint: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      starredMarketTickers: [],
      starredMarketsByTicker: {},
      starredTokenMints: [],
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      starMarket: (ticker, snapshot) => {
        const normalizedTicker = normalizeMarketTicker(ticker);
        return set((s) => ({
          starredMarketTickers: s.starredMarketTickers.includes(normalizedTicker)
            ? s.starredMarketTickers
            : [...s.starredMarketTickers, normalizedTicker],
          starredMarketsByTicker:
            snapshot
              ? {
                  ...s.starredMarketsByTicker,
                  [normalizedTicker]: {
                    ...snapshot,
                    ticker: normalizedTicker,
                  },
                }
              : s.starredMarketsByTicker,
        }));
      },
      unstarMarket: (ticker) => {
        const normalizedTicker = normalizeMarketTicker(ticker);
        set((s) => ({
          starredMarketTickers: s.starredMarketTickers.filter((t) => t !== normalizedTicker),
          starredMarketsByTicker: Object.fromEntries(
            Object.entries(s.starredMarketsByTicker).filter(([key]) => key !== normalizedTicker),
          ),
        }));
      },
      isMarketStarred: (ticker) => get().starredMarketTickers.includes(normalizeMarketTicker(ticker)),
      getMarketSnapshot: (ticker) => get().starredMarketsByTicker[normalizeMarketTicker(ticker)] ?? null,
      starToken: (mint) =>
        set((s) => ({
          starredTokenMints: s.starredTokenMints.includes(mint)
            ? s.starredTokenMints
            : [...s.starredTokenMints, mint],
        })),
      unstarToken: (mint) =>
        set((s) => ({
          starredTokenMints: s.starredTokenMints.filter((m) => m !== mint),
        })),
      isTokenStarred: (mint) => get().starredTokenMints.includes(mint),
    }),
    {
      name: "siren-watchlist",
      version: 2,
      partialize: (state) => ({
        starredMarketTickers: state.starredMarketTickers,
        starredMarketsByTicker: state.starredMarketsByTicker,
        starredTokenMints: state.starredTokenMints,
      }),
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<WatchlistState>;
        const starredMarketTickers = Array.isArray(state.starredMarketTickers)
          ? state.starredMarketTickers
              .filter((ticker): ticker is string => typeof ticker === "string" && ticker.trim().length > 0)
              .map(normalizeMarketTicker)
          : [];
        const starredMarketsByTicker = Object.fromEntries(
          Object.entries(
            state.starredMarketsByTicker && typeof state.starredMarketsByTicker === "object"
              ? state.starredMarketsByTicker
              : {},
          ).map(([ticker, snapshot]) => {
            const normalizedTicker = normalizeMarketTicker(ticker);
            return [
              normalizedTicker,
              {
                ...(snapshot as WatchlistMarketSnapshot),
                ticker: normalizedTicker,
              },
            ];
          }),
        ) as Record<string, WatchlistMarketSnapshot>;
        const starredTokenMints = Array.isArray(state.starredTokenMints)
          ? state.starredTokenMints.filter((mint): mint is string => typeof mint === "string" && mint.trim().length > 0)
          : [];

        return {
          hasHydrated: false,
          starredMarketTickers,
          starredMarketsByTicker,
          starredTokenMints,
        } satisfies Partial<WatchlistState>;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
