import { ImageResponse } from "next/og";
import { SocialCard } from "./social-card";
import { getSocialCardFonts } from "./social-card-fonts";

export const runtime = "nodejs";
export const alt = "Siren trading terminal social preview";
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
        eyebrow="Kalshi x Bags"
        title="Prediction markets meet meme token flow."
        subtitle="Track live Kalshi signals, surface token narratives, and trade both from one Siren screen."
      />
    ),
    {
      ...size,
      fonts,
    }
  );
}
