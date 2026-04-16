"use client";

import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { HomeInner } from "./HomeInner";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--bg-void)" }}>
      <header className="flex-shrink-0">
        <TopBar />
      </header>
      <main className="flex-1 min-h-0">
        <Suspense fallback={null}>
          <HomeInner />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
