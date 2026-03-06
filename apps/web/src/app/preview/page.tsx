"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PreviewTerminal } from "@/components/PreviewTerminal";

function PreviewContent() {
  const searchParams = useSearchParams();
  const theme = searchParams.get("theme") === "light" ? "light" : "dark";

  useEffect(() => {
    if (theme === "light") document.documentElement.classList.add("light");
    else document.documentElement.classList.remove("light");
  }, [theme]);

  return (
    <div className="h-full min-h-[260px] flex flex-col bg-[var(--bg-void)]">
      <PreviewTerminal />
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="h-[260px] bg-[var(--bg-void)]" />}>
      <PreviewContent />
    </Suspense>
  );
}
