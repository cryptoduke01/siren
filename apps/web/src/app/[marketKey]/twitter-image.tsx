import { ImageResponse } from "next/og";
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

  const title = market?.title ?? "Prediction market";
  const outcomeLabel = market?.selected_outcome_label?.trim() || null;
  const priceLabel =
    market != null && typeof market.probability === "number"
      ? `${Math.min(100, Math.max(0, market.probability)).toFixed(1)}%`
      : "Live pricing";
  const closeLabel =
    market?.close_time != null
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
          market.close_time < 1_000_000_000_000 ? market.close_time * 1000 : market.close_time,
        )
      : "Open";
  const sourceLabel = market?.source === "polymarket" ? "Polymarket" : "Kalshi";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          background: "#060609",
          color: "#F5F7FB",
          fontFamily: "Inter",
          padding: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            borderRadius: 36,
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "radial-gradient(circle at top left, rgba(0,255,133,0.14), transparent 34%), linear-gradient(180deg, rgba(16,17,26,0.98), rgba(8,9,14,0.95))",
            padding: 44,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  borderRadius: 999,
                  border: "1px solid rgba(0,255,133,0.18)",
                  padding: "10px 18px",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#9AF8C5",
                  background: "rgba(0,255,133,0.10)",
                }}
              >
                {sourceLabel}
              </div>
              {outcomeLabel ? (
                <div
                  style={{
                    display: "flex",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: "10px 18px",
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#DDE3ED",
                  }}
                >
                  {outcomeLabel}
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: "88%" }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Clash Display",
                  fontSize: 72,
                  lineHeight: 0.96,
                  fontWeight: 700,
                  letterSpacing: "-0.06em",
                }}
              >
                {title}
              </div>
              <div style={{ display: "flex", fontSize: 28, lineHeight: 1.35, color: "#A4ACBA" }}>
                {outcomeLabel ? `Outcome: ${outcomeLabel}` : "Live market details"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 18 }}>
            {[
              { label: "Current price", value: priceLabel, tone: "#00FF85" },
              { label: "Closes", value: closeLabel, tone: "#F5F7FB" },
              { label: "Ticker", value: market?.ticker ?? parsed?.ticker ?? "Market", tone: "#BDD4FF" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  gap: 10,
                  borderRadius: 24,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(12,13,20,0.92)",
                  padding: 24,
                }}
              >
                <div style={{ display: "flex", fontSize: 16, letterSpacing: "0.14em", textTransform: "uppercase", color: "#70798B" }}>
                  {item.label}
                </div>
                <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: item.tone }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
