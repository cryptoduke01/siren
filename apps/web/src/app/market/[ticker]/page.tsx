import type { Metadata } from "next";
import { MarketRoutePageClient } from "@/components/MarketRoutePageClient";
import { buildLegacyMarketPath } from "@/lib/marketLinks";
import { buildMarketMetadata, fetchMarketByTickerServer } from "@/lib/serverMarket";

type MarketTickerPageProps = {
  params: Promise<{ ticker: string }>;
};

export async function generateMetadata({ params }: MarketTickerPageProps): Promise<Metadata> {
  const { ticker } = await params;
  const market = await fetchMarketByTickerServer(ticker);
  return buildMarketMetadata(market, buildLegacyMarketPath(ticker));
}

export default async function MarketTickerPage({ params }: MarketTickerPageProps) {
  const { ticker } = await params;
  return <MarketRoutePageClient ticker={ticker} />;
}
