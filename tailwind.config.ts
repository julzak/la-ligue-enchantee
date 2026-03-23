import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        night: "var(--color-night)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        gold: "#C8A84B",
        "gold-dim": "#8A7133",
        paper: "#F5F2EB",
        "paper-dim": "#E8E4DB",
        rouge: "#C0392B",
        vert: "#1A6B3C",
        muted: "var(--color-muted)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
