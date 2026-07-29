// PostCSS is the tool that runs Tailwind: it reads our CSS, finds the
// @tailwind directives, and replaces them with the generated utility classes.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}, // adds vendor prefixes (-webkit- etc.) automatically
  },
};
