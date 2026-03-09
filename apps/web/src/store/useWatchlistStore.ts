import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Watchlist is persisted to localStorage (key: siren-watchlist) — survives refresh, new tabs, browser restarts.
 * Clearing site data will reset it. For cross-device sync, a backend (e.g. Supabase) would be needed. */
interface WatchlistState {
  starredMarketTickers: string[];
  starredTokenMints: string[];
  starMarket: (ticker: string) => void;
  unstarMarket: (ticker: string) => void;
  isMarketStarred: (ticker: string) => boolean;
  starToken: (mint: string) => void;
  unstarToken: (mint: string) => void;
  isTokenStarred: (mint: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      starredMarketTickers: [],
      starredTokenMints: [],
      starMarket: (ticker) =>
        set((s) => ({
          starredMarketTickers: s.starredMarketTickers.includes(ticker)
            ? s.starredMarketTickers
            : [...s.starredMarketTickers, ticker],
        })),
      unstarMarket: (ticker) =>
        set((s) => ({
          starredMarketTickers: s.starredMarketTickers.filter((t) => t !== ticker),
        })),
      isMarketStarred: (ticker) => get().starredMarketTickers.includes(ticker),
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
    { name: "siren-watchlist" }
  )
);
