"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { MarketWithVelocity } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ACCESS_COOKIE = "siren_access";
const TERMINAL_PATHS = ["/", "/portfolio", "/trending", "/watchlist", "/onboarding"];

function fetchMarkets(): Promise<MarketWithVelocity[]> {
  return fetch(`${API_URL}/api/markets`, { credentials: "omit" })
    .then((r) => {
      if (!r.ok) throw new Error(`Markets API error: ${r.status}`);
      return r.json();
    })
    .then((j) => j.data ?? []);
}

function isTerminalPath(pathname: string): boolean {
  return pathname === "/" || TERMINAL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function getHasAccessCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${ACCESS_COOKIE}=`));
}

export function useMarkets() {
  const pathname = usePathname();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const ok = isTerminalPath(pathname) && getHasAccessCookie();
    setHasAccess(ok);
  }, [pathname]);

  return useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    enabled: hasAccess,
    refetchInterval: hasAccess ? 60_000 : false,
    retry: 2,
  });
}
