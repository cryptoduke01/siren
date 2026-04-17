"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { MarketExecutionSurface } from "@/components/MarketExecutionSurface";
import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import { toSelectedMarket } from "@/lib/marketSelection";
import { useSirenWallet } from "@/contexts/SirenWalletContext";

export default function MarketSharePage() {
  const params = useParams();
  const router = useRouter();
  const ticker = params.ticker as string;
  const { connected, isReady } = useSirenWallet();
  const { data: markets = [], isLoading } = useMarkets();
  const { selectedMarket, setSelectedMarket } = useSirenStore();

  useEffect(() => {
    if (isReady && !connected) router.replace("/onboarding");
  }, [connected, isReady, router]);

  useEffect(() => {
    if (!ticker || markets.length === 0) return;
    const market = markets.find((item) => item.ticker === ticker);
    if (market) {
      setSelectedMarket(toSelectedMarket(market));
    }
  }, [ticker, markets, setSelectedMarket]);

  if (!isReady || !connected) return null;

  const marketExists = markets.some((item) => item.ticker === ticker);

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 px-2 py-3 md:px-4 md:py-5 xl:px-6">
        {isLoading ? (
          <div className="mx-auto h-[720px] w-full max-w-[1540px] rounded-[28px] border" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }} />
        ) : !marketExists ? (
          <div className="mx-auto max-w-3xl rounded-[28px] border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
            <p className="font-heading text-2xl font-semibold" style={{ color: "var(--text-1)" }}>
              Market not found.
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              This market is no longer in the live feed or the ticker changed. Go back to the explorer and reopen it from the latest market list.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-4 rounded-full border px-4 py-2 font-body text-sm font-semibold"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-surface))" }}
            >
              Back to explorer
            </button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[1540px]">
            <MarketExecutionSurface />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
