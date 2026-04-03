import type { Metadata } from "next";
import { QueryProvider } from "@/components/QueryProvider";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Siren — Event-Driven Meme Token Terminal",
  description: "Watch Kalshi markets, surface Bags tokens, trade both from one terminal.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060609" },
    { media: "(prefers-color-scheme: light)", color: "#F0F0F5" },
  ],
  appleWebApp: { capable: true, title: "Siren" },
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
