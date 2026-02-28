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
      className="h-12 flex-shrink-0 flex items-center justify-between px-4"
      style={{ height: "48px", background: "var(--bg-base)" }}
    >
      <Link
        href="/"
        className="font-heading font-extrabold text-xl tracking-[0.15em] flex flex-col items-start"
        style={{ color: "var(--accent-primary)" }}
        onClick={() => hapticLight()}
      >
        SIREN
        <span
          className="mt-1 h-px"
          style={{ width: "60%", background: "var(--accent-primary)" }}
        />
      </Link>
      <nav className="flex items-center gap-1 rounded-full border p-0.5" style={{ borderColor: "var(--border)" }}>
        {NAV.map(({ href, label }) => {
          const isActive = pathname === href || (href === "/" && pathname === "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => hapticLight()}
              className={`px-4 py-2 rounded-full text-xs font-heading font-semibold transition-all duration-[120ms] ease-in-out ${
                isActive
                  ? "text-[var(--bg-base)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              style={
                isActive
                  ? { background: "var(--accent-primary)" }
                  : undefined
              }
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
