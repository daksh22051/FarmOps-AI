import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { 50: "#f1f7f2", 100: "#dcebdd", 600: "#39734b", 700: "#285b3a", 800: "#1e472f" },
        canvas: "#f7f7f3",
        ink: "#203029",
      },
      boxShadow: {
        card: "0 1px 2px rgba(32, 48, 41, 0.04), 0 12px 30px rgba(32, 48, 41, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
