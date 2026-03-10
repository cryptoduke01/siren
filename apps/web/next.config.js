/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  transpilePackages: ['@siren/shared', '@solana/wallet-adapter-base', '@solana/wallet-adapter-react', '@solana/wallet-adapter-react-ui', '@solana/wallet-adapter-wallets', '@privy-io/react-auth'],
  webpack: (config) => {
    // Privy Solana: avoid bundling @solana/kit + @solana-program/* (version conflict)
    config.externals = config.externals || {};
    config.externals['@solana/kit'] = 'commonjs @solana/kit';
    config.externals['@solana-program/memo'] = 'commonjs @solana-program/memo';
    config.externals['@solana-program/system'] = 'commonjs @solana-program/system';
    config.externals['@solana-program/token'] = 'commonjs @solana-program/token';
    return config;
  },
};

module.exports = nextConfig;
