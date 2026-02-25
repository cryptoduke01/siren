"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { WalletButton } from "./WalletButton";
import { useThemeStore } from "@/store/useThemeStore";
import { hapticLight } from "@/lib/haptics";

const NAV = [
  { href: "/", label: "Terminal" },
  { href: "/trending", label: "Trending" },
  { href: "/portfolio", label: "Portfolio" },
];

export function TopBar() {
  const pathname = usePathname();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <header className="h-14 border-b border-siren-border bg-siren-surface/80 dark:bg-siren-bg/90 backdrop-blur-xl flex items-center justify-between px-4 flex-shrink-0">
      <Link href="/" className="font-heading font-bold text-xl text-siren-primary tracking-tight" onClick={() => hapticLight()}>
        SIREN
      </Link>
      <nav className="flex items-center gap-1">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            onClick={() => hapticLight()}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              pathname === href || (href === "/" && pathname === "/")
                ? "bg-siren-primary text-white dark:text-siren-bg"
                : "text-siren-text-secondary hover:text-siren-text-primary hover:bg-siren-border/50"
            }`}
          >
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => { hapticLight(); toggleTheme(); }}
          className="p-2 rounded-full text-siren-text-secondary hover:text-siren-primary hover:bg-siren-border/50 transition-colors ml-2"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <WalletButton />
      </nav>
    </header>
  );
}
