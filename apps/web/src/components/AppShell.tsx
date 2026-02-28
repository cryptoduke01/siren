"use client";

import { UnifiedBuyPanel } from "./UnifiedBuyPanel";
import { ThemeSync } from "./ThemeSync";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeSync />
      {children}
      <UnifiedBuyPanel />
    </>
  );
}
