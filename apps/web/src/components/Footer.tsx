"use client";

import Link from "next/link";
import { hapticLight } from "@/lib/haptics";
import { useSirenWallet } from "@/contexts/SirenWalletContext";

export function Footer() {
  const { connected } = useSirenWallet();
  return (
    <footer className="w-full border-t" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
      <div className="max-w-5xl mx-auto px-5 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
            (c) {new Date().getFullYear()} Siren
          </p>
          <p className="font-body text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
            Event-driven meme terminal.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://docs.onsiren.xyz"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticLight()}
            className="font-body text-xs underline"
            style={{ color: "var(--text-2)" }}
          >
            Docs
          </a>
          <a
            href="https://x.com/sirenmarketsxyz"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticLight()}
            className="font-body text-xs underline"
            style={{ color: "var(--text-2)" }}
          >
            X: @sirenmarketsxyz
          </a>
          <Link
            href="/terms"
            onClick={() => hapticLight()}
            className="font-body text-xs underline"
            style={{ color: "var(--text-2)" }}
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            onClick={() => hapticLight()}
            className="font-body text-xs underline"
            style={{ color: "var(--text-2)" }}
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
