/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind scans these files and generates CSS only for classes actually used:
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // App palette — referenced as e.g. className="bg-surface text-accent"
        ink: "#0b1220",       // darkest background (sidebar)
        surface: "#111a2e",   // card / panel background
        line: "#22304d",      // borders
        accent: "#38bdf8",    // primary accent (sky)
        soft: "#94a3b8",      // secondary text
      },
    },
  },
  plugins: [],
};
