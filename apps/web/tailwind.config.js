/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        siren: {
          bg: "var(--siren-bg)",
          surface: "var(--siren-surface)",
          primary: "var(--siren-primary)",
          "primary-hover": "var(--siren-primary-hover)",
          secondary: "var(--siren-secondary)",
          bags: "var(--siren-bags)",
          kalshi: "var(--siren-kalshi)",
          text: "var(--siren-text)",
          "text-primary": "var(--siren-text-primary)",
          "text-secondary": "var(--siren-text-secondary)",
          border: "var(--siren-border)",
          accent: "var(--siren-accent)",
        },
      },
      fontFamily: {
        heading: ["var(--font-geist)", "var(--font-space-grotesk)", "sans-serif"],
        data: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
