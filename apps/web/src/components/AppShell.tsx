"use client";

import { UnifiedBuyPanel } from "./UnifiedBuyPanel";
import { ThemeSync } from "./ThemeSync";
import { ToastContainer } from "./Toast";
import { OnboardingModal } from "./OnboardingModal";
import { IssueBadge } from "./IssueBadge";
import { AlertChecker } from "./AlertChecker";
import { RegisterSW } from "./RegisterSW";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeSync />
      <RegisterSW />
      <AlertChecker />
      {children}
      <UnifiedBuyPanel />
      <ToastContainer />
      <OnboardingModal />
      <IssueBadge />
    </>
  );
}
