"use client";

import { UnifiedBuyPanel } from "./UnifiedBuyPanel";
import { ThemeSync } from "./ThemeSync";
import { ToastContainer } from "./Toast";
import { OnboardingModal } from "./OnboardingModal";
import { IssueBadge } from "./IssueBadge";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeSync />
      {children}
      <UnifiedBuyPanel />
      <ToastContainer />
      <OnboardingModal />
      <IssueBadge />
    </>
  );
}
