/**
 * Tag library: maps Kalshi market categories → CT-relevant keywords.
 * Used to surface Bags tokens when a Kalshi market heats up.
 */

export interface TagCategory {
  id: string;
  name: string;
  keywords: string[];
}

export const TAG_LIBRARY: TagCategory[] = [
  {
    id: "fed-rates",
    name: "Fed / Rates",
    keywords: ["jpow", "rates", "fed", "fomc", "printer", "brr", "ratecut", "ratehike", "inflation"],
  },
  {
    id: "cpi-inflation",
    name: "CPI / Inflation",
    keywords: ["cpi", "inflation", "prices", "dollar", "purchasing power"],
  },
  {
    id: "elections",
    name: "Elections",
    keywords: ["trump", "election", "vote", "potus", "whitehouse", "dc"],
  },
  {
    id: "crypto-regulation",
    name: "Crypto Regulation",
    keywords: ["sec", "gensler", "crypto law", "regulation", "etf"],
  },
  {
    id: "btc",
    name: "BTC Price",
    keywords: ["bitcoin", "btc", "sats", "satoshi", "digital gold", "number go up"],
  },
  {
    id: "eth-l2",
    name: "ETH / L2s",
    keywords: ["ethereum", "eth", "l2", "rollup", "based", "vitalik"],
  },
  {
    id: "ai",
    name: "AI",
    keywords: ["ai", "agi", "openai", "sam altman", "robot", "singularity"],
  },
  {
    id: "recession",
    name: "Recession",
    keywords: ["recession", "gdp", "unemployment", "layoffs", "economy"],
  },
  {
    id: "weather",
    name: "Weather / Natural Events",
    keywords: ["storm", "flood", "disaster", "climate"],
  },
];

export function getKeywordsForCategory(categoryId: string): string[] {
  const cat = TAG_LIBRARY.find((c) => c.id === categoryId);
  return cat?.keywords ?? [];
}

export function matchTokenToKeywords(tokenName: string, tokenSymbol: string, keywords: string[]): boolean {
  const combined = `${tokenName} ${tokenSymbol}`.toLowerCase();
  return keywords.some((kw) => combined.includes(kw.toLowerCase()));
}
