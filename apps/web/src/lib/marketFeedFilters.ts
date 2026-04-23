import type { MarketWithVelocity } from "@siren/shared";

export type MarketCategoryId = "all" | "sports" | "politics" | "crypto" | "finance" | "entertainment";

export type MarketTimePreset = "all" | "today" | "this_week" | "ending_soon" | "popular";

export type MarketSourceFilter = "all" | "kalshi" | "polymarket";

const CATEGORY_KEYWORDS: Record<Exclude<MarketCategoryId, "all">, string[]> = {
  sports: [
    "world cup",
    "ufc",
    "nba",
    "nfl",
    "mlb",
    "nhl",
    "soccer",
    "football",
    "basketball",
    "baseball",
    "tennis",
    "golf",
    "f1",
    "formula",
    "olymp",
    "championship",
    "super bowl",
    "laliga",
    "premier league",
    "ucl",
    "march madness",
    "ncaa",
    "college football",
    "college basketball",
  ],
  politics: [
    "trump",
    "biden",
    "election",
    "senate",
    "congress",
    "vote",
    "democrat",
    "republican",
    "president",
    "governor",
    "primaries",
    "electoral",
    "house",
    "parliament",
    "minister",
    "putin",
    "nato",
  ],
  crypto: [
    "bitcoin",
    "btc",
    "eth",
    "ethereum",
    "solana",
    "sol ",
    "crypto",
    "token",
    "defi",
    "nft",
    "sec ",
    "etf",
  ],
  finance: [
    "fed",
    "rates",
    "cpi",
    "inflation",
    "gdp",
    "earnings",
    "stock",
    "nasdaq",
    "s&p",
    "interest",
    "recession",
    "jobs report",
    "unemployment",
  ],
  entertainment: [
    "oscar",
    "grammy",
    "emmy",
    "golden globe",
    "award",
    "movie",
    "album",
    "billboard",
    "box office",
    "netflix",
    "spotify",
  ],
};

const CATEGORY_LABELS: Record<Exclude<MarketCategoryId, "all">, string> = {
  sports: "Sports",
  politics: "Politics",
  crypto: "Crypto",
  finance: "Finance",
  entertainment: "Entertainment",
};

const CATEGORY_BADGE_STYLES: Record<Exclude<MarketCategoryId, "all">, { bg: string; color: string }> = {
  sports: { bg: "rgba(34,197,94,0.35)", color: "#bbf7d0" },
  politics: { bg: "rgba(239,68,68,0.35)", color: "#fecaca" },
  crypto: { bg: "rgba(245,158,11,0.35)", color: "#fde68a" },
  finance: { bg: "rgba(59,130,246,0.35)", color: "#bfdbfe" },
  entertainment: { bg: "rgba(168,85,247,0.35)", color: "#e9d5ff" },
};

export function getMarketCategoryKeywords(id: MarketCategoryId): string[] {
  if (id === "all") return [];
  return CATEGORY_KEYWORDS[id];
}

export function inferMarketCategory(m: MarketWithVelocity): Exclude<MarketCategoryId, "all"> | null {
  const blob = `${m.title ?? ""} ${m.subtitle ?? ""} ${m.series_ticker ?? ""} ${m.ticker ?? ""}`.toLowerCase();
  const order: Exclude<MarketCategoryId, "all">[] = [
    "sports",
    "politics",
    "crypto",
    "finance",
    "entertainment",
  ];
  for (const id of order) {
    if (CATEGORY_KEYWORDS[id].some((k) => blob.includes(k))) return id;
  }
  return null;
}

export function marketCategoryLabel(id: Exclude<MarketCategoryId, "all">): string {
  return CATEGORY_LABELS[id];
}

export function marketCategoryBadgeStyle(id: Exclude<MarketCategoryId, "all">): { bg: string; color: string } {
  return CATEGORY_BADGE_STYLES[id];
}

export function marketMatchesCategory(m: MarketWithVelocity, category: MarketCategoryId): boolean {
  if (category === "all") return true;
  const kw = CATEGORY_KEYWORDS[category];
  const lower = `${m.title ?? ""} ${m.ticker ?? ""} ${m.subtitle ?? ""}`.toLowerCase();
  return kw.some((k) => lower.includes(k));
}

export function marketMatchesTimePreset(m: MarketWithVelocity, preset: MarketTimePreset): boolean {
  if (preset === "all" || preset === "popular") return true;
  const close = m.close_time;
  const now = Date.now();
  if (!close || close <= now) return false;
  const ms = close - now;
  if (preset === "today") return ms <= 24 * 60 * 60 * 1000;
  if (preset === "this_week") return ms <= 7 * 24 * 60 * 60 * 1000;
  if (preset === "ending_soon") return ms <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

export function marketCloseTimeMs(m: MarketWithVelocity): number | null {
  if (!m.close_time || !Number.isFinite(m.close_time)) return null;
  return m.close_time < 1_000_000_000_000 ? m.close_time * 1000 : m.close_time;
}

/** Hours until `close_time`, or `null` if unknown. Negative or zero means already closed or closing now. */
export function marketHoursUntilClose(m: MarketWithVelocity): number | null {
  const closeMs = marketCloseTimeMs(m);
  if (!closeMs) return null;
  return (closeMs - Date.now()) / (1000 * 60 * 60);
}

/**
 * Secondary sort for the terminal explorer (after live-signal boost).
 * Matches MarketFeed "hot" ordering: prefer larger |velocity| when the gap exceeds 0.5 pts; otherwise volume.
 */
export function compareMarketExplorerSecondaryPriority(
  left: MarketWithVelocity,
  right: MarketWithVelocity,
): number {
  const leftVel = Math.abs(left.velocity_1h ?? 0);
  const rightVel = Math.abs(right.velocity_1h ?? 0);
  const velDiff = rightVel - leftVel;
  if (Math.abs(velDiff) > 0.5) return velDiff;
  const leftVol = left.volume ?? 0;
  const rightVol = right.volume ?? 0;
  return rightVol - leftVol;
}

export function marketExplorerPriorityScore(m: MarketWithVelocity): number {
  const volumeBase = Math.max(0, m.volume_24h ?? m.volume ?? 0);
  const depthBase = Math.max(0, m.source === "polymarket" ? m.liquidity ?? 0 : m.open_interest ?? 0);
  const quoteBonus =
    ((m.yes_bid ?? 0) > 0 ? 1 : 0) +
    ((m.yes_ask ?? 0) > 0 ? 1 : 0) +
    ((m.no_bid ?? 0) > 0 ? 1 : 0) +
    ((m.no_ask ?? 0) > 0 ? 1 : 0);
  const hoursUntilClose = marketHoursUntilClose(m);

  let freshnessWeight = 0.55;
  if (hoursUntilClose != null) {
    if (hoursUntilClose <= 0) return -1;
    if (hoursUntilClose <= 1) freshnessWeight = 0.2;
    else if (hoursUntilClose <= 24) freshnessWeight = 1.3;
    else if (hoursUntilClose <= 24 * 7) freshnessWeight = 1.15;
    else if (hoursUntilClose <= 24 * 30) freshnessWeight = 0.85;
    else if (hoursUntilClose <= 24 * 90) freshnessWeight = 0.45;
    else if (hoursUntilClose <= 24 * 180) freshnessWeight = 0.22;
    else freshnessWeight = 0.08;
  }

  return freshnessWeight * (
    Math.log1p(volumeBase) * 1.7 +
    Math.log1p(depthBase) * 1.2 +
    Math.abs(m.velocity_1h ?? 0) * 2.5 +
    quoteBonus * 2
  );
}

export function tickerHue(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) >>> 0;
  return h % 360;
}
