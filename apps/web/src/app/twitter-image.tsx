import { ImageResponse } from "next/og";
import { SocialCard } from "./social-card";
import { getSocialCardFonts } from "./social-card-fonts";

export const runtime = "nodejs";
export const alt = "Siren — prediction markets, execution and risk";
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
        eyebrow="Prediction markets · Execution & risk"
        title="Signals, risk context, and execution in one flow."
        subtitle="Kalshi, Polymarket, and Solana — onsiren.xyz"
      />
    ),
    {
      ...size,
      fonts,
    }
  );
}
