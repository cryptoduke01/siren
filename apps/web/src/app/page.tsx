"use client";

import { Suspense } from "react";
import { CenteredLoaderState } from "@/components/CenteredLoaderState";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { HomeInner } from "./HomeInner";

function TerminalShellFallback() {
  return <CenteredLoaderState title="Loading Terminal" detail="Siren is syncing current markets and execution context." />;
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--bg-void)" }}>
      <header className="flex-shrink-0">
        <TopBar />
      </header>
      <main className="flex-1 min-h-0">
        <Suspense fallback={<TerminalShellFallback />}>
          <HomeInner />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
