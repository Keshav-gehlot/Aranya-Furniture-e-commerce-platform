import type { Config } from "tailwindcss";

/**
 * Aranya design system → Tailwind.
 * Token values live as CSS custom properties in src/app/globals.css (generated from the
 * design system's tokens.json). Classes here use the same names as the tokens.
 * Spacing: the system's 12-step scale (2, 4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128px) maps onto
 * Tailwind's default steps 0.5, 1, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32 — use only those.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    borderRadius: {
      none: "0",
      xs: "2px",
      sm: "4px",
      DEFAULT: "4px",
      md: "6px",
      lg: "12px",
      full: "9999px",
    },
    extend: {
      colors: {
        // semantic tokens
        primary: { DEFAULT: "#8b1c22", hover: "#700914", active: "#520004", subtle: "#fff4f3" },
        secondary: { DEFAULT: "#b73923", hover: "#9a2b19" },
        accent: "#de9e7b",
        page: "#ffffff",
        raised: "#ffffff",
        sunken: "#f9f5f4",
        hover: "#f2eceb",
        inverse: "#1f1716",
        "on-inverse": "#fdfaf9",
        line: "#e5dedc",
        control: "#948987",
        divider: "#f2eceb",
        ink: "#1f1716",
        "ink-2": "#635855",
        "ink-3": "#776c69",
        success: { DEFAULT: "#177f14", subtle: "#e8f9e7", text: "#1a6317" },
        info: { DEFAULT: "#0169e0", subtle: "#ebf3ff", text: "#0051b2" },
        warning: { DEFAULT: "#de9e7b", subtle: "#fff0e6", text: "#81411d" },
        danger: { DEFAULT: "#b02a2e", subtle: "#fff4f3", text: "#8b1c22" },
        neutral: {
          0: "#ffffff", 25: "#fdfaf9", 50: "#f9f5f4", 100: "#f2eceb", 200: "#e5dedc", 300: "#d0c6c4",
          400: "#948987", 500: "#776c69", 600: "#635855", 700: "#4c413e", 800: "#342a28", 900: "#1f1716", 950: "#140e0c",
        },
        maroon: {
          50: "#fff4f3", 100: "#fde7e5", 200: "#f6ccc8", 300: "#daa5a1", 400: "#c37c78", 500: "#ad5754",
          600: "#9d3c3b", 700: "#8b1c22", 800: "#700914", 900: "#520004",
        },
        sandscale: {
          50: "#fef8f1", 100: "#fcf0e1", 200: "#eed6bb", 300: "#d5b084", 400: "#b99871", 500: "#9d815f",
          600: "#80684c", 700: "#67533b", 800: "#4d3c28", 900: "#352511",
        },
        chart: { 1: "#8b1c22", 2: "#0169e0", 3: "#d5b084", 4: "#177f14", 5: "#de9e7b", 6: "#4c413e" },

        // names used by older markup, re-pointed at the tokens above
        linen: "#ffffff",
        sand: "#f9f5f4",
        clay: "#948987",
        peach: "#de9e7b",
        stone: "#635855",
        walnut: { DEFAULT: "#b73923", dark: "#8b1c22", light: "#985c54" },
        forest: { DEFAULT: "#8b1c22", light: "#700914" },
        emerald: { 50: "#e8f9e7", 100: "#e8f9e7", 700: "#1a6317", 800: "#1a6317" },
        sky: { 50: "#ebf3ff", 100: "#ebf3ff", 700: "#0051b2", 800: "#0051b2" },
        indigo: { 100: "#ebf3ff", 800: "#0051b2" },
        amber: { 50: "#fff0e6", 100: "#fff0e6", 800: "#81411d" },
        red: { 50: "#fff4f3", 100: "#fff4f3", 200: "#f6ccc8", 600: "#b02a2e", 700: "#8b1c22", 800: "#8b1c22" },
      },
      fontFamily: {
        display: ['"Anek Latin Variable"', '"Anek Latin"', "Arial", "sans-serif"],
        sans: ['"IBM Plex Sans"', '"Segoe UI"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(74, 32, 28, 0.08)",
        sm: "0 6px 16px -4px rgba(74, 32, 28, 0.14), 0 1px 3px rgba(74, 32, 28, 0.08)",
        md: "0 -8px 24px -8px rgba(74, 32, 28, 0.18), 0 2px 8px rgba(74, 32, 28, 0.08)",
        lg: "0 24px 48px -12px rgba(74, 32, 28, 0.26), 0 4px 12px rgba(74, 32, 28, 0.10)",
        focus: "0 0 0 2px #ffffff, 0 0 0 4px #8b1c22",
      },
      maxWidth: { store: "1320px", text: "38rem", admin: "1600px" },
    },
  },
  plugins: [],
} satisfies Config;
