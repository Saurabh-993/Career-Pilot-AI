// AI settings + bridge control routes.
import { Router } from "express";
import { z } from "zod";
import { Settings } from "../models/Settings.js";
import { refreshSettings, KEY_VENDORS } from "../ai/provider.js";
import { encrypt } from "../lib/secrets.js";
import { detectClis, runBridgeTask, terminal, terminalBuffer } from "../bridge/bridgeManager.js";

export const aiRouter = Router();

// The key itself NEVER leaves the server — clients only learn whether one is set.
const publicSettings = (s) => ({
  aiTier: s?.aiTier ?? "groq",
  bridgeCli: s?.bridgeCli ?? "",
  keyVendor: s?.keyVendor ?? "",
  keyModel: s?.keyModel ?? "",
  keySet: Boolean(s?.encKey),
});

// GET /api/ai/settings
aiRouter.get("/settings", async (req, res, next) => {
  try {
    res.json({ ok: true, settings: publicSettings(await Settings.findOne().lean()) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ai/settings  { aiTier, bridgeCli?, keyVendor?, keyModel?, apiKey? }
aiRouter.put("/settings", async (req, res, next) => {
  try {
    const { aiTier, bridgeCli, keyVendor, keyModel, apiKey } = req.body;
    if (!["groq", "key", "bridge"].includes(aiTier))
      throw Object.assign(new Error("aiTier must be groq | key | bridge"), { status: 400 });
    if (aiTier === "key" && keyVendor && !KEY_VENDORS[keyVendor])
      throw Object.assign(new Error("keyVendor must be groq | openai | gemini"), { status: 400 });

    const update = {
      aiTier,
      bridgeCli: bridgeCli ?? "",
      keyVendor: keyVendor ?? "",
      keyModel: keyModel ?? "",
    };
    if (apiKey?.trim()) update.encKey = encrypt(apiKey.trim()); // only overwrite when a new key is typed

    const s = await Settings.findOneAndUpdate({}, update, { upsert: true, new: true });
    await refreshSettings(); // provider layer picks it up immediately
    res.json({ ok: true, settings: publicSettings(s) });
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/bridge/detect — which CLIs are installed on this machine?
aiRouter.get("/bridge/detect", (req, res) => {
  res.json({ ok: true, clis: detectClis() });
});

// POST /api/ai/bridge/test  { cli } — tiny end-to-end task through the sandbox
aiRouter.post("/bridge/test", async (req, res, next) => {
  try {
    const result = await runBridgeTask({
      cli: req.body.cli,
      instruction:
        'Return a JSON object exactly like {"message": "<one short sentence confirming you read context.md and can write to outbox>"}',
      schema: z.object({ message: z.string() }),
      contextMd: "This is a connectivity test from CareerPilot. The user just clicked 'Test bridge'.",
      timeoutMs: 60000, // fail fast during setup; real tasks get longer
    });
    res.json({ ok: true, message: result.message });
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/bridge/stream — live terminal output (SSE)
aiRouter.get("/bridge/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  const send = (line) => res.write(`data: ${JSON.stringify(line)}\n\n`);
  terminalBuffer().forEach(send); // replay history first
  terminal.on("line", send);
  req.on("close", () => terminal.off("line", send)); // avoid listener leaks
});
