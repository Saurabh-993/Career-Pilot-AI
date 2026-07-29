// Analysis routes — our first SSE (Server-Sent Events) endpoint.
//
// SSE = one long-lived HTTP response the server writes events into.
// Wire format (text): "event: <name>\ndata: <json>\n\n"
// The browser's EventSource API receives each as a named event, and
// auto-reconnects if the connection drops — for free.

import { Router } from "express";
import { Profile } from "../models/Profile.js";
import { generateDashboard } from "../pipelines/generateDashboard.js";

export const analysisRouter = Router();

// GET /api/analysis/dashboard/:resumeId/stream   (?refresh=1 to regenerate)
analysisRouter.get("/dashboard/:resumeId/stream", async (req, res) => {
  // These headers turn the response into an SSE stream:
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const send = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    // Cached? Serve instantly (dashboard loads cost zero AI calls on revisit).
    const existing = await Profile.findOne({ resumeId: req.params.resumeId });
    if (existing && !req.query.refresh) {
      send("done", existing.dashboard);
      return res.end();
    }

    const profile = await generateDashboard(req.params.resumeId, (stage) =>
      send("progress", { stage })
    );
    send("done", profile.dashboard);
  } catch (err) {
    req.log?.error({ err }, "dashboard generation failed");
    // Errors travel INSIDE the stream — the normal error handler can't help
    // here because headers are already sent.
    send("error", { message: err.message });
  }
  res.end();
});
