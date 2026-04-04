import type { Metadata, Viewport } from "next";
import { QueryProvider } from "@/components/QueryProvider";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://onsiren.xyz";
const socialPreviewVersion = "2026-04-04";
const ogImage = new URL(`/opengraph-image?v=${socialPreviewVersion}`, siteUrl).toString();
const twitterImage = new URL(`/twitter-image?v=${socialPreviewVersion}`, siteUrl).toString();

export const metadata: Metadata = {
  title: "Siren | Prediction Markets x Meme Tokens",
  description: "Track Kalshi and Polymarket signals, surface Solana token narratives, and trade from one terminal.",
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
    title: "Siren | Prediction Markets x Meme Tokens",
    description: "Track Kalshi and Polymarket signals, surface Solana token narratives, and trade from one terminal.",
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
    site: "@sirentracker",
    creator: "@sirentracker",
    title: "Siren | Prediction Markets x Meme Tokens",
    description: "Track Kalshi and Polymarket signals, surface Solana token narratives, and trade from one terminal.",
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
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,600,700&display=swap"
        />
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
