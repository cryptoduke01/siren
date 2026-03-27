import { ImageResponse } from "next/og";
import { SocialCard } from "./social-card";

export const runtime = "edge";
export const alt = "Siren trading terminal social preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <SocialCard
        eyebrow="Event-driven terminal"
        title="Trade signals, not noise."
        subtitle="Watch live Kalshi markets, route into Solana meme flow, and manage prediction positions from one screen."
      />
    ),
    size
  );
}
