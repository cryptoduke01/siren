import { ImageResponse } from "next/og";
import { SocialCard } from "./social-card";

export const runtime = "edge";
export const alt = "Siren X card preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <SocialCard
        eyebrow="Prediction x Solana"
        title="One terminal for markets and memes."
        subtitle="From Kalshi signal to token execution, Siren keeps the trade path fast, visual, and uncluttered."
      />
    ),
    size
  );
}
