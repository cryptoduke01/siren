"use client";

import { Suspense } from "react";
import { CenteredLoaderState } from "@/components/CenteredLoaderState";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { HomeInner } from "../HomeInner";

function TerminalShellFallback() {
  return (
    <CenteredLoaderState
      title="Loading Terminal"
      detail="Siren is syncing current markets and execution context."
      phrases={[
        "Checking live Kalshi books",
        "Pulling fresh Polymarket listings",
        "Preparing route context",
        "Building the terminal view",
      ]}
    />
  );
}

export default function TerminalPage() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--bg-void)" }}>
      <header className="flex-shrink-0">
        <TopBar />
      </header>
      <main className="min-h-0 flex-1">
        <Suspense fallback={<TerminalShellFallback />}>
          <HomeInner />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
