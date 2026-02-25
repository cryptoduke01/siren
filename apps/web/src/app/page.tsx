"use client";

import { TopBar } from "@/components/TopBar";
import { MarketFeed } from "@/components/MarketFeed";
import { TokenSurface } from "@/components/TokenSurface";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        <aside className="w-full lg:w-[35%] lg:min-w-[300px] lg:max-w-[420px] border-b lg:border-b-0 lg:border-r border-siren-border flex-shrink-0 overflow-y-auto bg-siren-surface/50 dark:bg-siren-bg/80 backdrop-blur-sm">
          <MarketFeed />
        </aside>
        <section className="flex-1 overflow-y-auto p-4 md:p-6 min-h-[50vh] lg:min-h-0 bg-siren-bg/30 dark:bg-transparent">
          <TokenSurface />
        </section>
      </main>
    </div>
  );
}
