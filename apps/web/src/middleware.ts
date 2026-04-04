import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Terminal gate: when enabled, / and terminal routes require siren_access cookie.
 * Gate is ON by default; set SIREN_GATE_ENABLED=false to disable (e.g. local dev). */
const ACCESS_COOKIE = "siren_access";
const TERMINAL_PATHS = ["/", "/portfolio", "/trending", "/watchlist", "/onboarding", "/settings", "/leaderboard"];

function isTerminalPath(pathname: string) {
  return pathname === "/" || TERMINAL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const forwardedHost = (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() || "";
  const hostStr = `${host} ${forwardedHost}`.toLowerCase();
  // Gate removed — never block access
  const shouldGate = false;

  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  if (shouldGate) {
    const allowedWithoutCookie =
      pathname === "/landing" ||
      pathname === "/waitlist" ||
      pathname === "/admin" ||
      pathname === "/access" ||
      pathname === "/preview" ||
      pathname === "/terms" ||
      pathname === "/privacy" ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname === "/icon.svg" ||
      pathname === "/favicon.ico" ||
      pathname.startsWith("/brand") ||
      pathname === "/manifest.json";

    if (allowedWithoutCookie) {
      return NextResponse.next();
    }

    if (isTerminalPath(pathname)) {
      // Let terminal routes through — AccessGate shows the modal when no cookie
    } else {
      url.pathname = "/waitlist";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

