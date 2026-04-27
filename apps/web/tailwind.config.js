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
        heading: ["Clash Display", "Cabinet Grotesk", "Inter", "ui-sans-serif", "sans-serif"],
        body: ["Cabinet Grotesk", "Inter", "ui-sans-serif", "sans-serif"],
        money: ["Departure Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sub: ["Cabinet Grotesk", "Inter", "ui-sans-serif", "sans-serif"],
        label: ["Clash Display", "Cabinet Grotesk", "Inter", "ui-sans-serif", "sans-serif"],
        mono: ["Departure Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
