const DEFAULT_SITE_URL = "https://onsiren.xyz";

function normalizeSiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_SITE_URL;
  return trimmed.replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (typeof env === "string" && env.trim().length > 0) {
    return normalizeSiteUrl(env);
  }
  return DEFAULT_SITE_URL;
}
