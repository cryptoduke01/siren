"use client";

import Link from "next/link";
import { hapticLight } from "@/lib/haptics";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-void)" }}
    >
      <div className="text-center max-w-md">
        <p
          className="font-mono text-6xl md:text-8xl font-bold tabular-nums mb-2"
          style={{ color: "var(--text-3)" }}
        >
          404
        </p>
        <h1
          className="font-heading font-bold text-xl md:text-2xl mb-3"
          style={{ color: "var(--text-1)" }}
        >
          Page not found
        </h1>
        <p
          className="font-body text-sm mb-8"
          style={{ color: "var(--text-2)" }}
        >
          This page doesn’t exist or has been moved.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            onClick={() => hapticLight()}
            className="font-heading font-semibold text-sm uppercase tracking-wider px-5 py-2.5 rounded-[10px] transition-all duration-200"
            style={{
              background: "var(--accent)",
              color: "var(--accent-text)",
            }}
          >
            Go to terminal
          </Link>
          <Link
            href="/waitlist"
            onClick={() => hapticLight()}
            className="font-body font-medium text-sm px-5 py-2.5 rounded-[10px] border transition-colors duration-200 hover:border-[var(--accent)]"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-2)",
            }}
          >
            Waitlist
          </Link>
        </div>
      </div>
    </div>
  );
}
