import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#1a73e8",
          red: "#ea4335",
          green: "#34a853",
          yellow: "#fbbc04",
        },
      },
    },
  },
  plugins: [],
};

export default config;
