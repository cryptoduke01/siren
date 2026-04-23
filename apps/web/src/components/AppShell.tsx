"use client";

import { usePathname } from "next/navigation";
import { UnifiedBuyPanel } from "./UnifiedBuyPanel";
import { GlobalResultModal } from "./GlobalResultModal";
import { GlobalTradePnLShareModal } from "./GlobalTradePnLShareModal";
import { ThemeSync } from "./ThemeSync";
import { ToastContainer } from "./Toast";
import { OnboardingModal } from "./OnboardingModal";
import { IssueBadge } from "./IssueBadge";
import { AlertChecker } from "./AlertChecker";
import { RegisterSW } from "./RegisterSW";
import { AccessGate } from "./AccessGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicRoute =
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/waitlist";

  return (
    <>
      <ThemeSync />
      <RegisterSW />
      <AlertChecker />
      <AccessGate>
        {children}
      </AccessGate>
      {!publicRoute && <UnifiedBuyPanel />}
      {!publicRoute && <GlobalResultModal />}
      {!publicRoute && <GlobalTradePnLShareModal />}
      <ToastContainer />
      {!publicRoute && <OnboardingModal />}
      {!publicRoute && <IssueBadge />}
    </>
  );
}
