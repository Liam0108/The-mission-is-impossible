import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        stroke: "rgb(var(--stroke) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        positive: "rgb(var(--positive) / <alpha-value>)",
        caution: "rgb(var(--caution) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)"
      },
      boxShadow: {
        soft: "0 20px 60px rgb(15 23 42 / 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

