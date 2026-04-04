import { ImageResponse } from "next/og";
import { SocialCard } from "./social-card";
import { getSocialCardFonts } from "./social-card-fonts";

export const runtime = "nodejs";
export const alt = "Siren X card preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function TwitterImage() {
  const fonts = await getSocialCardFonts();
  return new ImageResponse(
    (
      <SocialCard
        eyebrow="Prediction markets, simplified"
        title="One fast feed for Kalshi, Polymarket, and token momentum."
        subtitle="Open Siren, spot the move, and trade from one clean screen."
      />
    ),
    {
      ...size,
      fonts,
    }
  );
}
