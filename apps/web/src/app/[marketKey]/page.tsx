import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarketRoutePageClient } from "@/components/MarketRoutePageClient";
import { parseMarketKey } from "@/lib/marketLinks";
import { buildMarketMetadata, fetchMarketByTickerServer } from "@/lib/serverMarket";

type MarketKeyPageProps = {
  params: Promise<{ marketKey: string }>;
};

export async function generateMetadata({ params }: MarketKeyPageProps): Promise<Metadata> {
  const { marketKey } = await params;
  const parsed = parseMarketKey(marketKey);
  if (!parsed) {
    return buildMarketMetadata(null, "/terminal");
  }
  const market = await fetchMarketByTickerServer(parsed.ticker);
  return buildMarketMetadata(market, `/${marketKey}`);
}

export default async function MarketKeyPage({ params }: MarketKeyPageProps) {
  const { marketKey } = await params;
  const parsed = parseMarketKey(marketKey);
  if (!parsed) {
    notFound();
  }

  return <MarketRoutePageClient ticker={parsed.ticker} />;
}
