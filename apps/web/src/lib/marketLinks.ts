type MarketLinkInput = {
  ticker: string;
  title?: string | null;
  selectedOutcomeLabel?: string | null;
};

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugifyMarketTitle(title?: string | null, selectedOutcomeLabel?: string | null): string {
  const parts = [title?.trim(), selectedOutcomeLabel?.trim()].filter((value): value is string => !!value);
  const slug = slugifySegment(parts.join(" "));
  return slug || "market";
}

export function buildMarketKey({ ticker, title, selectedOutcomeLabel }: MarketLinkInput): string {
  const safeTicker = ticker.trim();
  if (!safeTicker) return "market";
  return `${slugifyMarketTitle(title, selectedOutcomeLabel)}--${safeTicker}`;
}

export function parseMarketKey(marketKey: string): { slug: string; ticker: string } | null {
  const trimmed = marketKey.trim();
  if (!trimmed) return null;
  const boundary = trimmed.lastIndexOf("--");
  if (boundary <= 0 || boundary >= trimmed.length - 2) return null;

  const slug = trimmed.slice(0, boundary).trim();
  const ticker = trimmed.slice(boundary + 2).trim();
  if (!slug || !ticker) return null;
  return { slug, ticker };
}

export function buildMarketPath(input: MarketLinkInput): string {
  return `/${buildMarketKey(input)}`;
}

export function buildLegacyMarketPath(ticker: string): string {
  return `/market/${encodeURIComponent(ticker.trim())}`;
}

export function buildAbsoluteMarketUrl(input: MarketLinkInput, siteUrl: string): string {
  return new URL(buildMarketPath(input), siteUrl).toString();
}
