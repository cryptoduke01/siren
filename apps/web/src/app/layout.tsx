import type { Metadata } from "next";
import { Syne, IBM_Plex_Mono } from "next/font/google";
import { QueryProvider } from "@/components/QueryProvider";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const syne = Syne({ variable: "--font-syne", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const ibmPlexMono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Siren — Event-Driven Meme Token Terminal",
  description: "Watch Kalshi markets, surface Bags tokens, trade both from one terminal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('siren-theme');if(s){var p=JSON.parse(s);var t=p&&p.state&&p.state.theme;document.documentElement.classList.add(t==='light'?'light':'dark');}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="font-body bg-[var(--bg-base)] text-[var(--text-primary)] antialiased min-h-screen selection:bg-[var(--accent-primary)]/30 selection:text-[var(--bg-base)]">
        <Providers>
          <QueryProvider>
            <AppShell>{children}</AppShell>
          </QueryProvider>
        </Providers>
      </body>
    </html>
  );
}
