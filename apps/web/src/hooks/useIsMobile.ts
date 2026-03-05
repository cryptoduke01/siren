"use client";

import { useState, useEffect } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}

/** True when viewport < 1024px (Tailwind lg). Use for layout that hides main panel and shows markets-only. */
export function useIsMobileLg() {
  const [isMobileLg, setIsMobileLg] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const check = () => setIsMobileLg(mql.matches);
    check();
    mql.addEventListener("change", check);
    return () => mql.removeEventListener("change", check);
  }, []);

  return isMobileLg;
}
