// App settings — singleton document (one per install).
import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
  {
    aiTier: { type: String, enum: ["groq", "key", "bridge"], default: "groq" },
    bridgeCli: { type: String, enum: ["", "claude", "gemini", "codex"], default: "" },
    // Tier 2 — bring your own API key (encrypted at rest, see lib/secrets.js)
    keyVendor: { type: String, enum: ["", "groq", "openai", "gemini"], default: "" },
    keyModel: { type: String, default: "" }, // empty = vendor default
    encKey: { type: String, default: "" }, // AES-256-GCM ciphertext, never returned to client
  },
  { timestamps: true }
);

export const Settings = mongoose.model("Settings", SettingsSchema);
