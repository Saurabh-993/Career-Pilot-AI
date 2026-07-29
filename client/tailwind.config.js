/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind scans these files and generates CSS only for classes actually used:
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens point at CSS variables (see index.css) → light/dark theming
        // works app-wide by toggling one class on <html>.
        // "<alpha-value>" lets Tailwind still do opacity like bg-ink/50.
        ink: "rgb(var(--ink) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        soft: "rgb(var(--soft) / <alpha-value>)",
        strong: "rgb(var(--strong) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
