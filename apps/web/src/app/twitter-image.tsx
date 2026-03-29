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
        eyebrow="Builder grant x hackathon"
        title="Kalshi + Polymarket signals. One execution rail."
        subtitle="Siren turns prediction market moves into tradable Solana token flow with a faster, cleaner trading screen."
      />
    ),
    {
      ...size,
      fonts,
    }
  );
}
