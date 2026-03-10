"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hapticLight } from "@/lib/haptics";

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header
      className="h-14 flex items-center justify-between px-4 flex-shrink-0"
      style={{
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-6">
        <Link
          href="/"
          onClick={() => hapticLight()}
          className="flex items-center gap-2 py-2 topbar-logo-wrap"
        >
          <img
            src="/brand/mark.svg"
            alt="Siren"
            className="h-7 w-auto md:h-8 topbar-logo"
            style={{ display: "block" }}
          />
        </Link>
        <nav className="flex items-center gap-4">
          <span className="font-heading font-semibold text-sm uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
            Admin
          </span>
          <Link
            href="/waitlist"
            onClick={() => hapticLight()}
            className="font-body text-xs uppercase tracking-wide transition-colors"
            style={{ color: pathname === "/waitlist" ? "var(--accent)" : "var(--text-3)" }}
          >
            Waitlist
          </Link>
          <Link
            href="/"
            onClick={() => hapticLight()}
            className="font-body text-xs uppercase tracking-wide transition-colors"
            style={{ color: pathname === "/" ? "var(--accent)" : "var(--text-3)" }}
          >
            Terminal
          </Link>
        </nav>
      </div>
    </header>
  );
}
