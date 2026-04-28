import { ImageResponse } from "next/og";
import { SocialCard } from "@/app/social-card";
import { getSocialCardFonts } from "@/app/social-card-fonts";
import { parseMarketKey } from "@/lib/marketLinks";
import { fetchMarketByTickerServer } from "@/lib/serverMarket";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

type MarketImageProps = {
  params: Promise<{ marketKey: string }>;
};

export default async function TwitterImage({ params }: MarketImageProps) {
  const { marketKey } = await params;
  const parsed = parseMarketKey(marketKey);
  const market = parsed ? await fetchMarketByTickerServer(parsed.ticker) : null;
  const fonts = await getSocialCardFonts();

  const title = market?.selected_outcome_label ? `${market.title} · ${market.selected_outcome_label}` : market?.title ?? "Prediction market";
  const subtitle =
    market != null
      ? `${market.source === "polymarket" ? "Polymarket" : "Kalshi"} · ${
          typeof market.probability === "number" ? `${Math.min(100, Math.max(0, market.probability)).toFixed(1)}% YES` : "Live pricing"
        } · onsiren.xyz`
      : "Execution and risk intelligence for prediction markets.";

  return new ImageResponse(
    (
      <SocialCard
        eyebrow="Market link · Siren"
        title={title}
        subtitle={subtitle}
      />
    ),
    {
      ...size,
      fonts,
    },
  );
}
