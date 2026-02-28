/**
 * Geo-fencing for DFlow prediction market trading (Kalshi compliance).
 * Block US and restricted Kalshi jurisdictions per:
 * https://pond.dflow.net/legal/prediction-market-compliance
 */

const RESTRICTED_COUNTRY_CODES = new Set([
  "US", // United States
  "AF", // Afghanistan
  "DZ", // Algeria
  "AO", // Angola
  "AU", // Australia
  "BY", // Belarus
  "BE", // Belgium
  "BO", // Bolivia
  "BG", // Bulgaria
  "BF", // Burkina Faso
  "CM", // Cameroon
  "CA", // Canada
  "CF", // Central African Republic
  "CI", // Côte d'Ivoire
  "CU", // Cuba
  "CD", // Democratic Republic of the Congo
  "ET", // Ethiopia
  "FR", // France
  "HT", // Haiti
  "IR", // Iran
  "IQ", // Iraq
  "IT", // Italy
  "KE", // Kenya
  "LA", // Laos
  "LB", // Lebanon
  "LY", // Libya
  "ML", // Mali
  "MC", // Monaco
  "MZ", // Mozambique
  "MM", // Myanmar (Burma)
  "NA", // Namibia
  "NI", // Nicaragua
  "NE", // Niger
  "KP", // North Korea
  "CN", // People's Republic of China
  "PL", // Poland
  "RU", // Russia
  "SG", // Singapore
  "SO", // Somalia
  "SS", // South Sudan
  "SD", // Sudan
  "CH", // Switzerland
  "SY", // Syria
  "TW", // Taiwan
  "TH", // Thailand
  "UA", // Ukraine
  "AE", // United Arab Emirates
  "GB", // United Kingdom (includes UK)
  "UK", // United Kingdom (alternate)
  "VE", // Venezuela
  "YE", // Yemen
  "ZW", // Zimbabwe
]);

/**
 * Returns true if the country code is in a restricted jurisdiction (block trading).
 */
export function isRestrictedJurisdiction(countryCode: string | null | undefined): boolean {
  if (!countryCode || typeof countryCode !== "string") return false;
  const cc = countryCode.toUpperCase().trim();
  return RESTRICTED_COUNTRY_CODES.has(cc);
}

/**
 * Use with X-Forwarded-For / Cf-Ipcountry (Cloudflare) or similar.
 * Returns true if we should block (restricted), false if allowed.
 */
export function shouldBlockByCountry(countryCode: string | null | undefined): boolean {
  return isRestrictedJurisdiction(countryCode);
}
