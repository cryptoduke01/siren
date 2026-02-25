"use client";

import { useSirenStore } from "@/store/useSirenStore";
import { UnifiedBuyPanel } from "./UnifiedBuyPanel";
import { ThemeSync } from "./ThemeSync";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { selectedMarket, selectedToken } = useSirenStore();

  return (
    <>
      <ThemeSync />
      {children}
      {(selectedMarket || selectedToken) && <UnifiedBuyPanel />}
    </>
  );
}
