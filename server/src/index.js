// CareerPilot AI — API server entry point.
// Express = the web framework: it receives HTTP requests, runs them through
// "middleware" (small functions in a chain), and sends responses.

import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { getProvider } from "./ai/provider.js";

const app = express();

// --- Middleware chain (runs in order for every request) ---
app.use(cors()); // CORS = lets the Vite dev server (port 5173) call this API (port 3001)
app.use(express.json()); // parses JSON request bodies into req.body
app.use(
  // pino = fast structured logger; pino-pretty makes it human-readable in dev.
  // Every request gets logged with a unique id → errors are traceable (robustness rule).
  pinoHttp({ transport: { target: "pino-pretty", options: { colorize: true } } })
);

// --- Routes ---

// Health check: "is the server alive and configured?"
// Also used by the frontend Dashboard card to prove client ↔ server wiring works.
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    groqKeyConfigured: Boolean(process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.startsWith("paste_")),
  });
});

// AI smoke test: one tiny Groq call to verify the provider layer end-to-end.
app.get("/api/ai/test", async (req, res, next) => {
  try {
    const text = await getProvider().complete(
      "Reply with one short friendly sentence confirming the CareerPilot AI backend can reach you."
    );
    res.json({ ok: true, text });
  } catch (err) {
    next(err); // hand errors to the central error handler below
  }
});

// --- Central error handler (must be last; Express detects it by its 4 arguments) ---
// Guarantees the client always gets clean JSON, never a crashed connection.
app.use((err, req, res, next) => {
  req.log.error({ err }, "request failed");
  res.status(err.status || 500).json({ ok: false, error: err.message || "Internal server error" });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`✅ CareerPilot API running at http://localhost:${port}`);
});
