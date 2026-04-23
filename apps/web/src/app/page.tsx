"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { HomeInner } from "./HomeInner";

function TerminalShellFallback() {
  return (
    <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-3 py-4 md:px-5 md:py-6">
      <div className="rounded-[22px] border p-4 md:p-5" style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), var(--bg-base))" }}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--accent)" }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body text-xs font-semibold uppercase tracking-[0.12em]">Loading Terminal</span>
            </div>
            <p className="mt-4 font-heading text-[1.15rem] font-semibold tracking-[-0.05em] md:text-[1.5rem]" style={{ color: "var(--text-1)" }}>
              Bringing Current Markets Into View
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed md:text-[15px]" style={{ color: "var(--text-2)" }}>
              Siren is syncing the latest prediction books, routing context, and explorer filters.
            </p>
            <div className="progress-track mt-4 max-w-xl">
              <span className="progress-bar" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 xl:w-[390px]">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[18px] border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", minHeight: 96 }}>
                <div className="loader-line w-14" />
                <div className="mt-3 loader-line w-10" />
                <div className="mt-2 loader-line w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-[22px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", minHeight: 248 }}>
            <div className="loader-line w-20" />
            <div className="mt-5 space-y-3">
              <div className="loader-line w-[72%]" />
              <div className="loader-line w-[58%]" />
            </div>
            <div className="mt-6 space-y-2.5">
              {Array.from({ length: 4 }).map((__, row) => (
                <div key={row} className="loader-row">
                  <div className="loader-line w-[62%]" />
                  <div className="loader-line w-10" />
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              <div className="loader-box" />
              <div className="loader-box" />
            </div>
          </div>
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
