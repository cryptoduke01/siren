import { create } from "zustand";
import type { MarketCategoryId, MarketSourceFilter } from "@/lib/marketFeedFilters";

interface ExplorerState {
  query: string;
  source: MarketSourceFilter;
  category: MarketCategoryId;
  setQuery: (query: string) => void;
  setSource: (source: MarketSourceFilter) => void;
  setCategory: (category: MarketCategoryId) => void;
  reset: () => void;
}

export const useExplorerStore = create<ExplorerState>((set) => ({
  query: "",
  source: "all",
  category: "all",
  setQuery: (query) => set({ query }),
  setSource: (source) => set({ source }),
  setCategory: (category) => set({ category }),
  reset: () => set({ query: "", source: "all", category: "all" }),
}));
