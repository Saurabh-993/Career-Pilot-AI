import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The proxy solves a dev-time problem: the browser loads the app from
// Vite (http://localhost:5173), but the API lives on http://localhost:3001.
// With this proxy, the frontend just calls fetch("/api/...") and Vite
// silently forwards it to the server — no ports or CORS in frontend code.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
