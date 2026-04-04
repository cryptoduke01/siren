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

export function tickerHue(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) >>> 0;
  return h % 360;
}
