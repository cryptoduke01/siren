"use client";

import Link from "next/link";
import { hapticLight } from "@/lib/haptics";

export function Footer() {
  return (
    <footer className="w-full border-t" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
      <div className="max-w-5xl mx-auto px-5 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
            © {new Date().getFullYear()} Siren
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
            href="https://x.com/sirentracker"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticLight()}
            className="font-body text-xs underline"
            style={{ color: "var(--text-2)" }}
          >
            X: @sirentracker
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
          <Link
            href="/waitlist"
            onClick={() => hapticLight()}
            className="font-body text-xs underline"
            style={{ color: "var(--text-2)" }}
          >
            Waitlist
          </Link>
        </div>
      </div>
    </footer>
  );
}

