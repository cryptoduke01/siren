const path = require("path");

const proxyTarget = (process.env.SIREN_API_PROXY_TARGET || "").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async rewrites() {
    const rewrites = [{ source: "/privacy", destination: "/privacy.html" }];
    if (proxyTarget) {
      rewrites.push({
        source: "/backend/:path*",
        destination: `${proxyTarget}/:path*`,
      });
    }
    return rewrites;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  transpilePackages: [
    "@siren/shared",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-wallets",
    "@privy-io/react-auth",
  ],
};

module.exports = nextConfig;
