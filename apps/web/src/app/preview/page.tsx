"use client";

import { TopBar } from "@/components/TopBar";
import { PreviewTerminal } from "@/components/PreviewTerminal";

export default function PreviewPage() {
  return (
    <div className="h-full min-h-[260px] flex flex-col bg-[var(--bg-void)]">
      <header className="flex-shrink-0">
        <TopBar />
      </header>
      <PreviewTerminal />
    </div>
  );
}
