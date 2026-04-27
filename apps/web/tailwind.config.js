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
        heading: ["Cabinet Grotesk", "Clash Display", "Inter", "ui-sans-serif", "sans-serif"],
        /** Primary UI copy favors a wider, more readable default across the product. */
        body: ["Inter", "Cabinet Grotesk", "ui-sans-serif", "sans-serif"],
        /** Balances, USD, PnL keep the sharper display face but fall back safely. */
        money: ["Clash Display", "Cabinet Grotesk", "Inter", "sans-serif"],
        /** Secondary labels, meta, captions. */
        sub: ["Inter", "ui-sans-serif", "sans-serif"],
        label: ["Departure Mono", "ui-monospace", "monospace"],
        mono: ["Departure Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
