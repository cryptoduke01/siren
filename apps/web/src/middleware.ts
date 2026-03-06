import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** On production (onsiren.xyz): terminal is gated. Only /waitlist, /admin, /access, /preview (and static) are allowed without cookie. */
const ACCESS_COOKIE = "siren_access";
const TERMINAL_PATHS = ["/", "/portfolio", "/trending", "/watchlist", "/onboarding"];

function isTerminalPath(pathname: string) {
  return pathname === "/" || TERMINAL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  const isProdHost = host.includes("onsiren.xyz");

  if (isProdHost) {
    const allowedWithoutCookie =
      pathname === "/waitlist" ||
      pathname === "/admin" ||
      pathname === "/access" ||
      pathname === "/preview" ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname === "/icon.svg" ||
      pathname.startsWith("/brand") ||
      pathname === "/manifest.json";

    if (allowedWithoutCookie) {
      return NextResponse.next();
    }

    if (isTerminalPath(pathname)) {
      const hasAccess = req.cookies.get(ACCESS_COOKIE)?.value === "1";
      if (!hasAccess) {
        url.pathname = "/access";
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

