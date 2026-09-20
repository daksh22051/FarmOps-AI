import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        navy: {
          950: "#050a14",
          900: "#0a0f1a",
          850: "#0d1424",
          800: "#111827",
          700: "#1e293b",
          600: "#334155",
        },
        forest: { 50: "#f1f7f2", 100: "#dcebdd", 600: "#39734b", 700: "#285b3a", 800: "#1e472f" },
        canvas: "#0a0f1a",
        ink: "#e2e8f0",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.2), 0 12px 30px rgba(0, 0, 0, 0.15)",
        "glow-sm": "0 0 10px rgba(52,211,153,0.1)",
        "glow-md": "0 0 20px rgba(52,211,153,0.15)",
        "glow-lg": "0 0 40px rgba(52,211,153,0.2)",
        "glow-rose": "0 0 20px rgba(251,113,133,0.15)",
        "glow-violet": "0 0 20px rgba(167,139,250,0.15)",
        "glow-amber": "0 0 20px rgba(251,191,36,0.15)",
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "shimmer": "shimmer 2s infinite",
        "float": "float 3s ease-in-out infinite",
        "border-glow": "border-glow 3s ease-in-out infinite",
        "fade-in": "fade-in 0.4s ease-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.15)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "border-glow": {
          "0%, 100%": { borderColor: "rgba(52,211,153,0.15)" },
          "50%": { borderColor: "rgba(52,211,153,0.35)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
