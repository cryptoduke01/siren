import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Siren Docs — Event-Driven Meme Token Terminal",
  description: "Documentation for Siren: watch Kalshi markets, surface tokens, trade from one terminal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <Link href="/" className="logo">Siren</Link>
            <nav>
              <Link href="/">Introduction</Link>
              <Link href="/getting-started">Getting started</Link>
              <Link href="/terminal">Terminal</Link>
              <Link href="/portfolio">Portfolio</Link>
              <Link href="/launch">Launch</Link>
              <Link href="/account">Account</Link>
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
