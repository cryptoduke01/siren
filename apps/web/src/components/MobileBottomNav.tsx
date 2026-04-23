"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Trophy, Wallet, UserRound } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

const HIDDEN_PATHS = [
  "/",
  "/access",
  "/admin",
  "/landing",
  "/onboarding",
  "/preview",
  "/terms",
  "/waitlist",
];

const ITEMS = [
  { href: "/terminal", label: "Feed", icon: LayoutGrid },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/portfolio", label: "Wallet", icon: Wallet },
  { href: "/settings", label: "Profile", icon: UserRound },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const hidden = HIDDEN_PATHS.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (hidden) return;
    const previousPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "88px";
    return () => {
      document.body.style.paddingBottom = previousPadding;
    };
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[70] border-t px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 md:hidden"
      style={{
        borderColor: "color-mix(in srgb, var(--border-subtle) 84%, transparent)",
        background: "color-mix(in srgb, var(--bg-base) 92%, transparent)",
        backdropFilter: "blur(22px)",
      }}
      aria-label="Primary"
    >
      <div
        className="mx-auto grid max-w-md grid-cols-4 gap-2 rounded-[22px] border px-2 py-2"
        style={{
          borderColor: "color-mix(in srgb, var(--border-subtle) 88%, transparent)",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 92%, transparent), var(--bg-base))",
          boxShadow: "0 -14px 32px -28px rgba(0, 0, 0, 0.75)",
        }}
      >
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => hapticLight()}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition-all active:scale-[0.98]"
              style={{
                background: active ? "color-mix(in srgb, var(--accent) 18%, var(--bg-surface))" : "transparent",
                color: active ? "var(--accent)" : "var(--text-3)",
                border: `1px solid ${
                  active ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "transparent"
                }`,
              }}
            >
              <Icon className="h-4 w-4" />
              <span className="font-body text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
