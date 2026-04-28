import type { Metadata } from "next";
import type { MarketWithVelocity } from "@siren/shared";
import { API_URL } from "@/lib/apiUrl";
import { buildAbsoluteMarketUrl, buildMarketPath } from "@/lib/marketLinks";
import { getSiteUrl } from "@/lib/siteUrl";

const socialPreviewVersion = "2026-04-28-market-links";

type MarketApiResponse = {
  success?: boolean;
  error?: string;
  data?: MarketWithVelocity;
};

function formatMarketCents(probability?: number | null, side: "yes" | "no" = "yes"): string | null {
  if (probability == null || !Number.isFinite(probability)) return null;
  const yes = Math.min(100, Math.max(0, probability));
  const cents = side === "yes" ? yes : 100 - yes;
  return `${cents.toFixed(1)}c`;
}

function formatMarketClose(value?: number | null): string | null {
  if (!value || !Number.isFinite(value)) return null;
  const timestampMs = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestampMs);
}

function marketHeadline(market: MarketWithVelocity): string {
  return market.selected_outcome_label ? `${market.title} · ${market.selected_outcome_label}` : market.title;
}

function marketDescription(market: MarketWithVelocity): string {
  const source = market.source === "polymarket" ? "Polymarket" : "Kalshi";
  const yes = formatMarketCents(market.probability, "yes");
  const no = formatMarketCents(market.probability, "no");
  const close = formatMarketClose(market.close_time);

  return [
    `${source} market on Siren.`,
    market.selected_outcome_label ? `Outcome: ${market.selected_outcome_label}.` : null,
    yes && no ? `YES ${yes} · NO ${no}.` : null,
    close ? `Closes ${close}.` : null,
    "Execution and risk intelligence in one shareable market page.",
  ]
    .filter(Boolean)
    .join(" ");
}

function marketImagePath(market: MarketWithVelocity, kind: "opengraph" | "twitter"): string {
  const key = buildMarketPath({
    ticker: market.ticker,
    title: market.title,
    selectedOutcomeLabel: market.selected_outcome_label,
  });
  return `${key}/${kind}-image?v=${socialPreviewVersion}`;
}

export async function fetchMarketByTickerServer(ticker: string): Promise<MarketWithVelocity | null> {
  const trimmed = ticker.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(`${API_URL}/api/markets/${encodeURIComponent(trimmed)}`, {
      next: { revalidate: 30 },
    });
    const body = (await res.json().catch(() => ({}))) as MarketApiResponse;
    if (!res.ok || !body?.data) return null;
    return body.data;
  } catch {
    return null;
  }
}

export function buildMarketMetadata(market: MarketWithVelocity | null, fallbackPath: string): Metadata {
  const siteUrl = getSiteUrl();

  if (!market) {
    const fallbackUrl = new URL(fallbackPath, siteUrl).toString();
    return {
      title: "Market | Siren",
      description: "Execution and risk intelligence for prediction markets.",
      alternates: { canonical: fallbackPath },
      openGraph: {
        type: "website",
        url: fallbackUrl,
        title: "Market | Siren",
        description: "Execution and risk intelligence for prediction markets.",
      },
      twitter: {
        card: "summary_large_image",
        title: "Market | Siren",
        description: "Execution and risk intelligence for prediction markets.",
      },
    };
  }

  const title = `${marketHeadline(market)} | Siren`;
  const description = marketDescription(market);
  const canonicalPath = buildMarketPath({
    ticker: market.ticker,
    title: market.title,
    selectedOutcomeLabel: market.selected_outcome_label,
  });
  const canonicalUrl = buildAbsoluteMarketUrl(
    {
      ticker: market.ticker,
      title: market.title,
      selectedOutcomeLabel: market.selected_outcome_label,
    },
    siteUrl,
  );
  const ogImage = new URL(marketImagePath(market, "opengraph"), siteUrl).toString();
  const twitterImage = new URL(marketImagePath(market, "twitter"), siteUrl).toString();

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      siteName: "Siren",
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: marketHeadline(market),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterImage],
    },
  };
}
