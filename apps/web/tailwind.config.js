/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Clash Display", "sans-serif"],
        /** Primary UI copy (paired with Cabinet Grotesk from layout). */
        body: ["Cabinet Grotesk", "Inter", "ui-sans-serif", "sans-serif"],
        /** Balances, USD, PnL: Clash Display, not Inter. */
        money: ["Clash Display", "sans-serif"],
        /** Secondary labels, meta, captions. */
        sub: ["Inter", "ui-sans-serif", "sans-serif"],
        label: ["Departure Mono", "ui-monospace", "monospace"],
        mono: ["Departure Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
