import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const DOCS_SITE = "https://docs.onsiren.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(DOCS_SITE),
  title: {
    default: "Siren Docs — Execution & risk for prediction markets",
    template: "%s · Siren Docs",
  },
  description:
    "Reference for Siren: Kalshi and Polymarket signals, Solana execution, portfolio context. Fast terminal at onsiren.xyz.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: DOCS_SITE,
    siteName: "Siren Docs",
    title: "Siren Docs",
    description:
      "Execution and risk intelligence for prediction markets — Kalshi, Polymarket, Solana.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@sirenmarketsxyz",
    creator: "@sirenmarketsxyz",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <Link href="/" className="logo">
              Siren
            </Link>
            <nav>
              <Link href="/">Introduction</Link>
              <Link href="/getting-started">Getting started</Link>
              <Link href="/terminal">Terminal</Link>
              <Link href="/portfolio">Portfolio</Link>
              <Link href="/account">Account</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </nav>
            <p className="sidebar-foot">
              <a href="https://onsiren.xyz" target="_blank" rel="noopener noreferrer">
                Open terminal →
              </a>
            </p>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
