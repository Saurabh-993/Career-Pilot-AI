// AI Provider Layer — the single doorway to ALL AI in this app (PLAN.md §4).
// Tier routing from Settings: groq (free default) | key (user's own API key)
// | bridge (subscription CLI, Groq fallback). App code just calls getProvider().
import { GroqProvider, OpenAICompatProvider } from "./groqProvider.js";
import { BridgeProvider } from "./bridgeProvider.js";
import { Settings } from "../models/Settings.js";
import { decrypt } from "../lib/secrets.js";

// OpenAI-compatible endpoints + sensible default models per vendor.
export const KEY_VENDORS = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.0-flash",
  },
};

let groq = null;
let active = null;
let settingsCache = null;

/** Load settings into memory. Called at boot and whenever settings change. */
export async function refreshSettings() {
  try {
    settingsCache = await Settings.findOne().lean();
  } catch {
    settingsCache = null; // DB down → fail-soft to Groq default
  }
  active = null; // rebuild with the new tier on next call
}

export function getProvider() {
  if (!groq) groq = new GroqProvider(process.env.GROQ_API_KEY);
  if (active) return active;

  const s = settingsCache;
  try {
    if (s?.aiTier === "bridge" && s.bridgeCli) {
      active = new BridgeProvider(s.bridgeCli, groq);
    } else if (s?.aiTier === "key" && s.keyVendor && s.encKey) {
      const vendor = KEY_VENDORS[s.keyVendor];
      active = new OpenAICompatProvider({
        baseUrl: vendor.baseUrl,
        model: s.keyModel || vendor.defaultModel,
        apiKey: decrypt(s.encKey),
        name: s.keyVendor,
      });
    } else {
      active = groq;
    }
  } catch {
    active = groq; // bad key / decrypt failure → fail-soft to free tier
  }
  return active;
}
