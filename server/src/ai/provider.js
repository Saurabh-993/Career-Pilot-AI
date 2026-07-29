// AI Provider Layer — the single doorway to ALL AI in this app (PLAN.md §4).
//
// Every provider implements the same two methods:
//   complete(prompt, opts)      → plain text answer
//   json(prompt, zodSchema)     → object guaranteed to match the schema (validated!)
//
// Because the rest of the app only ever calls getProvider(), we can later swap in
// KeyProvider (user's own API key) or BridgeProvider (CLI subscription agent)
// without changing a single pipeline — that's the point of an abstraction layer.

import { GroqProvider } from "./groqProvider.js";

let activeProvider = null;

export function getProvider() {
  // Phase 0: always Groq. Later: read user settings to pick the tier,
  // and wrap providers in a fallback chain (Groq ← key ← bridge).
  if (!activeProvider) {
    activeProvider = new GroqProvider(process.env.GROQ_API_KEY);
  }
  return activeProvider;
}
