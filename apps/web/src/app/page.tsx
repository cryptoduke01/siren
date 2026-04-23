"use client";

import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { HomeInner } from "./HomeInner";

function TerminalShellFallback() {
  return (
    <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-3 py-4 md:px-5 md:py-6">
      <div className="rounded-[22px] border p-4 md:p-5" style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), var(--bg-base))" }}>
        <div className="grid gap-3 xl:grid-cols-[1.5fr_390px]">
          <div className="space-y-3">
            <div className="skeleton-card h-7 rounded-2xl" style={{ height: 28 }} />
            <div className="skeleton-card h-4 rounded-2xl" style={{ height: 18, maxWidth: 520 }} />
            <div className="flex flex-wrap gap-2 pt-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton-card rounded-full" style={{ height: 40, width: index === 0 ? 130 : 96 }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton-card rounded-[18px]" style={{ height: 112 }} />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="skeleton-card rounded-[22px]" style={{ height: 300 }} />
        ))}
      </div>
    </section>
  );
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
