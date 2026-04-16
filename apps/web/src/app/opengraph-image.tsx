import { ImageResponse } from "next/og";
import { SocialCard } from "./social-card";
import { getSocialCardFonts } from "./social-card-fonts";

export const runtime = "nodejs";
export const alt = "Siren — execution and risk intelligence for prediction markets";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const fonts = await getSocialCardFonts();
  return new ImageResponse(
    (
      <SocialCard
        eyebrow="Execution & risk · Kalshi · Polymarket · Solana"
        title="Act on prediction markets with clarity."
        subtitle="Live signals, sizing context, and execution in one terminal."
      />
    ),
    {
      ...size,
      fonts,
    }
  );
}
