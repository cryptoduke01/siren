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
          bg: "var(--bg-base)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          hover: "var(--bg-hover)",
          primary: "var(--accent-primary)",
          "primary-hover": "#b8e600",
          secondary: "var(--accent-secondary)",
          bags: "var(--accent-bags)",
          kalshi: "var(--accent-kalshi)",
          text: "var(--text-primary)",
          "text-primary": "var(--text-primary)",
          "text-secondary": "var(--text-secondary)",
          "text-tertiary": "var(--text-tertiary)",
          border: "var(--border)",
          "border-active": "var(--border-active)",
          red: "var(--red)",
          green: "var(--green)",
          yellow: "var(--yellow)",
          accent: "var(--accent-primary)",
        },
      },
      fontFamily: {
        heading: ["var(--font-syne)", "Syne", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
        data: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
        body: ["Satoshi", "var(--font-syne)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
