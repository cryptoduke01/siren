"use client";

import Link from "next/link";
import { BookOpen, Scale, Shield } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2H21.5l-7.11 8.128L22.75 22h-6.546l-5.128-6.708L5.21 22H1.95l7.604-8.69L1.5 2h6.712l4.636 6.127L18.244 2Zm-1.145 18h1.803L7.23 3.896H5.294L17.1 20Z" />
    </svg>
  );
}

function FooterIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const external = href.startsWith("http");

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => hapticLight()}
        aria-label={label}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      onClick={() => hapticLight()}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
    >
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer
      className="mt-auto w-full shrink-0 border-t"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5">
        <Link
          href="/"
          onClick={() => hapticLight()}
          aria-label="Siren home"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          style={{ borderColor: "color-mix(in srgb, var(--accent) 24%, var(--border-subtle))" }}
        >
          <img src="/brand/mark.svg" alt="" className="h-5 w-auto" />
        </Link>

        <div className="flex items-center gap-2">
          <FooterIconLink href="https://docs.onsiren.xyz" label="Docs">
            <BookOpen className="h-4 w-4" />
          </FooterIconLink>
          <FooterIconLink href="https://x.com/sirenmarketsxyz" label="X">
            <XIcon />
          </FooterIconLink>
          <FooterIconLink href="/terms" label="Terms">
            <Scale className="h-4 w-4" />
          </FooterIconLink>
          <FooterIconLink href="/privacy" label="Privacy">
            <Shield className="h-4 w-4" />
          </FooterIconLink>
        </div>
      </div>
    </footer>
  );
}
