"use client";

import { useEffect } from "react";
import { TerminalMarketExplorer } from "@/components/TerminalMarketExplorer";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useRouter } from "next/navigation";

export function HomeInner() {
  const router = useRouter();
  const { connected, isReady } = useSirenWallet();

  useEffect(() => {
    // Ungated app, but require onboarding before terminal usage.
    if (isReady && !connected) router.replace("/onboarding");
  }, [connected, isReady, router]);

  if (!isReady || !connected) {
    return null;
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <TerminalMarketExplorer />
    </div>
  );
}
