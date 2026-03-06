import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Terminal gate: when enabled, / and terminal routes require siren_access cookie.
 * Gate is ON by default; set SIREN_GATE_ENABLED=false to disable (e.g. local dev). */
const ACCESS_COOKIE = "siren_access";
const TERMINAL_PATHS = ["/", "/portfolio", "/trending", "/watchlist", "/onboarding"];

function isTerminalPath(pathname: string) {
  return pathname === "/" || TERMINAL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const forwardedHost = (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() || "";
  const hostStr = `${host} ${forwardedHost}`.toLowerCase();
  // Gate by default; only skip when explicitly disabled
  const gateDisabled = process.env.SIREN_GATE_ENABLED === "false" || process.env.SIREN_GATE_ENABLED === "0";
  const isProdHost = hostStr.includes("onsiren.xyz");
  const shouldGate = !gateDisabled || isProdHost;

  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  if (shouldGate) {
    const allowedWithoutCookie =
      pathname === "/waitlist" ||
      pathname === "/admin" ||
      pathname === "/access" ||
      pathname === "/preview" ||
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
      const hasAccess = req.cookies.get(ACCESS_COOKIE)?.value === "1";
      if (!hasAccess) {
        url.pathname = pathname === "/" ? "/waitlist" : "/access";
        return NextResponse.redirect(url);
      }
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

