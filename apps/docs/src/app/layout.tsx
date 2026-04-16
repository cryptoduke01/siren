import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import "./globals.css";

const DOCS_SITE = "https://docs.onsiren.xyz";

const clashDisplay = localFont({
  src: [
    { path: "../../../../brand-assets/fonts/clash-display-600.ttf", weight: "600", style: "normal" },
    { path: "../../../../brand-assets/fonts/clash-display-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-heading",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "../../../../brand-assets/fonts/inter-400.ttf", weight: "400", style: "normal" },
    { path: "../../../../brand-assets/fonts/inter-500.ttf", weight: "500", style: "normal" },
    { path: "../../../../brand-assets/fonts/inter-600.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(DOCS_SITE),
  title: {
    default: "Siren Docs — Execution and Risk Intelligence",
    template: "%s · Siren Docs",
  },
  description:
    "Siren docs for execution feasibility, route explanations, risk guardrails, onboarding, and portfolio context across prediction markets.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: DOCS_SITE,
    siteName: "Siren Docs",
    title: "Siren Docs",
    description:
      "Execution and risk intelligence for prediction markets — docs for onboarding, execution, portfolio, and account flows.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@sirenmarketsxyz",
    creator: "@sirenmarketsxyz",
  },
  alternates: { canonical: "/" },
};

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/getting-started", label: "Getting started" },
  { href: "/terminal", label: "Execution surface" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/account", label: "Account" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${clashDisplay.variable} ${inter.variable}`}>
      <body>
        <div className="docs-shell">
          <aside className="docs-sidebar">
            <Link href="/" className="docs-brand">
              <span className="docs-brand-mark" aria-hidden="true" />
              <span>Siren</span>
            </Link>

            <div className="docs-sidebar-card">
              <p className="docs-eyebrow">Category</p>
              <h1>Execution and risk intelligence for prediction markets.</h1>
              <p>
                Siren helps traders understand if a trade can clear, why it failed, and how exposed they are into resolution.
              </p>
            </div>

            <nav className="docs-nav" aria-label="Documentation">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="docs-sidebar-card docs-sidebar-mini">
              <p className="docs-eyebrow">Live product</p>
              <p>Use the terminal for real routing context, access codes, and portfolio-aware execution.</p>
              <div className="docs-sidebar-links">
                <a href="https://onsiren.xyz" target="_blank" rel="noopener noreferrer">
                  Open terminal
                </a>
                <a href="https://x.com/sirenmarketsxyz" target="_blank" rel="noopener noreferrer">
                  Follow X
                </a>
              </div>
            </div>
          </aside>

          <main className="docs-content">
            <div className="docs-content-inner">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
