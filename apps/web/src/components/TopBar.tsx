"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { useThemeStore } from "@/store/useThemeStore";
import { hapticLight } from "@/lib/haptics";

const NAV = [
  { href: "/", label: "Terminal" },
  { href: "/trending", label: "Trending" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/waitlist", label: "Waitlist" },
];

export function TopBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header
      className="h-[56px] flex items-center justify-between px-5"
      style={{
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <Link href="/" onClick={() => hapticLight()} className="flex items-center gap-2 py-2 topbar-logo-wrap">
        <img
          src="/brand/mark.svg"
          alt="Siren"
          className="h-8 w-auto md:h-9 topbar-logo"
          style={{ display: "block" }}
        />
      </Link>
      <nav className="flex items-center gap-6">
        {NAV.map(({ href, label }) => {
          const isActive = pathname === href || (href === "/" && pathname === "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => hapticLight()}
              className="font-body font-medium text-xs uppercase"
              style={{
                letterSpacing: "0.08em",
                color: isActive ? "var(--text-1)" : "var(--text-3)",
                borderBottom: isActive ? "1px solid var(--accent)" : "1px solid transparent",
                marginBottom: "-1px",
                paddingBottom: "2px",
                transition: "color 120ms ease, border-color 120ms ease",
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { hapticLight(); toggleTheme(); }}
          className="w-8 h-8 rounded-[6px] flex items-center justify-center font-mono text-sm transition-colors duration-[120ms] ease hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-2)" }}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? "☀" : "☽"}
        </button>
        <WalletButton />
      </div>
    </header>
  );
}
