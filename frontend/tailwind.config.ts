import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#F8FAFC",
          surface: "#FFFFFF",
          subtle: "#F1F5F9",
        },
        border: {
          base: "#E2E8F0",
          strong: "#CBD5E1",
        },
        text: {
          main: "#0F172A",
          secondary: "#334155",
          muted: "#64748B",
          faint: "#94A3B8",
        },
        brand: {
          primary: "#0EA5E9",
          secondary: "#10B981",
          deep: "#0369A1",
        },
        severity: {
          critical: "#EF4444",
          high: "#F97316",
          medium: "#F59E0B",
          low: "#22C55E",
          info: "#3B82F6",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

export default config;
