"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { hapticLight } from "@/lib/haptics";

const NAV = [
  { href: "/", label: "Terminal" },
  { href: "/trending", label: "Trending" },
  { href: "/portfolio", label: "Portfolio" },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <header
      className="h-[44px] flex items-center justify-between px-4"
      style={{
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <Link
        href="/"
        className="font-heading font-bold text-[18px]"
        style={{ color: "var(--accent)", letterSpacing: "0.2em" }}
        onClick={() => hapticLight()}
      >
        SIREN
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
      <WalletButton />
    </header>
  );
}
