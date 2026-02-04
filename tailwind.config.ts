import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./actions/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
        },
        success: "var(--color-success)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
      },
      borderRadius: {
        input: "var(--radius-input)",
        card: "var(--radius-card)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "title-page": [
          "1.75rem",
          {
            lineHeight: "2.25rem",
            fontWeight: "700",
          },
        ],
        "title-section": [
          "1.125rem",
          {
            lineHeight: "1.75rem",
            fontWeight: "600",
          },
        ],
        "body-base": [
          "1rem",
          {
            lineHeight: "1.5rem",
            fontWeight: "500",
          },
        ],
        meta: [
          "0.8125rem",
          {
            lineHeight: "1.25rem",
          },
        ],
        "money-xl": [
          "2.5rem",
          {
            lineHeight: "1.1",
            fontWeight: "700",
          },
        ],
      },
    },
  },
};

export default config;
