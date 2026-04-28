"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TerminalMarketExplorer } from "@/components/TerminalMarketExplorer";
import { buildLegacyMarketPath } from "@/lib/marketLinks";

export function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const marketTicker = searchParams.get("market");
    if (!marketTicker) return;
    router.replace(buildLegacyMarketPath(marketTicker));
  }, [router, searchParams]);

  return <TerminalMarketExplorer />;
}
