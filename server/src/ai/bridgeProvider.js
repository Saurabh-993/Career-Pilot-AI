// BridgeProvider — Tier 3: the user's subscription CLI does the heavy JSON
// generation; Groq remains the fallback and handles light/plain-text calls.
// Same interface as GroqProvider → zero changes anywhere else in the app.
import { runBridgeTask, terminal } from "../bridge/bridgeManager.js";

export class BridgeProvider {
  constructor(cli, fallback) {
    this.cli = cli;
    this.fallback = fallback; // GroqProvider
  }

  /** Structured output → bridge first, Groq on any failure (fallback chain). */
  async json(prompt, schema, opts = {}) {
    try {
      return await runBridgeTask({
        cli: this.cli,
        instruction: prompt,
        schema,
        contextMd: opts.contextMd ?? "",
      });
    } catch (e) {
      terminal.emit("line", `↩ falling back to Groq: ${e.message.slice(0, 120)}`);
      return this.fallback.json(prompt, schema, opts);
    }
  }

  /** Light/plain-text calls stay on Groq — spawning a CLI per chat is wasteful. */
  async complete(prompt, opts = {}) {
    return this.fallback.complete(prompt, opts);
  }
}
