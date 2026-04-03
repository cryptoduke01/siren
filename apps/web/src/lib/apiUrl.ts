const DEFAULT_API_URL = "http://localhost:4000";
const RENDER_API_URL = "https://siren-1.onrender.com";
const DEFAULT_WS_URL = "ws://localhost:4000/ws";
const RENDER_WS_URL = "wss://siren-1.onrender.com/ws";

function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim();
  // If it's a relative path like "/backend", that will break in production.
  if (!trimmed || trimmed.startsWith("/")) return DEFAULT_API_URL;
  // Avoid accidental double slashes in `${API_URL}/api/...`
  return trimmed.replace(/\/+$/, "");
}

function resolveApiUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (typeof env !== "string" || env.trim().length === 0) {
    return process.env.NODE_ENV === "production" ? RENDER_API_URL : DEFAULT_API_URL;
  }

  // If it looks relative (starts with "/"), treat it as misconfiguration.
  if (env.trim().startsWith("/")) {
    return process.env.NODE_ENV === "production" ? RENDER_API_URL : DEFAULT_API_URL;
  }

  return normalizeApiUrl(env);
}

/**
 * Shared backend base URL for the frontend.
 *
 * In production we fall back to the Render API when `NEXT_PUBLIC_API_URL` is misconfigured
 * (e.g. set to "/backend" which causes 404s on the same origin).
 */
export const API_URL: string = resolveApiUrl();

/**
 * WebSocket URL for live updates (signals). If `NEXT_PUBLIC_WS_URL` is unset or invalid,
 * derives `ws(s)://<host>/ws` from {@link API_URL} so production does not default to localhost.
 */
export const WS_URL: string = (() => {
  const env = process.env.NEXT_PUBLIC_WS_URL;
  if (typeof env === "string" && env.trim().length > 0) {
    const t = env.trim();
    if (!t.startsWith("/") && (t.startsWith("ws://") || t.startsWith("wss://"))) {
      return t.replace(/\/+$/, "");
    }
  }

  try {
    const u = new URL(API_URL);
    const protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${u.host}/ws`;
  } catch {
    return process.env.NODE_ENV === "production" ? RENDER_WS_URL : DEFAULT_WS_URL;
  }
})();

