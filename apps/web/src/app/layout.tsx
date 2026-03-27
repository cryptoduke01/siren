import type { Metadata, Viewport } from "next";
import { QueryProvider } from "@/components/QueryProvider";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://onsiren.xyz";
const ogImage = "/opengraph-image";
const twitterImage = "/twitter-image";

export const metadata: Metadata = {
  title: "Siren — Event-Driven Meme Token Terminal",
  description: "Watch Kalshi markets, surface Bags tokens, trade both from one terminal.",
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Siren",
    title: "Siren — Event-Driven Meme Token Terminal",
    description: "Watch Kalshi markets, surface Bags tokens, trade both from one terminal.",
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "Siren trading terminal preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Siren — Event-Driven Meme Token Terminal",
    description: "Watch Kalshi markets, surface Bags tokens, trade both from one terminal.",
    images: [twitterImage],
  },
  appleWebApp: { capable: true, title: "Siren" },
};

export const viewport: Viewport = {
  themeColor: "#060609",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('siren-theme');if(s){var p=JSON.parse(s);var t=p&&p.state&&p.state.theme;document.documentElement.classList.add(t==='light'?'light':'dark');}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="font-body bg-[var(--bg-void)] text-[var(--text-1)] antialiased min-h-screen selection:bg-[var(--accent-dim)] selection:text-[var(--accent-text)]">
        <Providers>
          <QueryProvider>
            <AppShell>{children}</AppShell>
          </QueryProvider>
        </Providers>
      </body>
    </html>
  );
}
