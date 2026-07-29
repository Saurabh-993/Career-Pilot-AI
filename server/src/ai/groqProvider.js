// GroqProvider — Tier 1 (free default).
// Groq hosts open models (Llama 3.3 70B) behind an OpenAI-compatible HTTP API
// and is extremely fast. We call it with plain fetch — no SDK needed.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export class GroqProvider {
  constructor(apiKey) {
    if (!apiKey) throw new Error("GROQ_API_KEY is missing — copy server/.env.example to server/.env and add your key");
    this.apiKey = apiKey;
  }

  // Low-level call shared by complete() and json().
  async #chat(messages, { jsonMode = false, temperature = 0.7 } = {}) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        // jsonMode forces the model to output syntactically valid JSON only
        ...(jsonMode && { response_format: { type: "json_object" } }),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Groq API error ${res.status}: ${body.slice(0, 300)}`);
      err.status = res.status === 429 ? 429 : 502; // 429 = rate-limited (free tier)
      throw err;
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  /** Plain-text completion. */
  async complete(prompt, opts = {}) {
    return this.#chat([{ role: "user", content: prompt }], opts);
  }

  /**
   * Structured completion — THE robustness backbone (PLAN.md §13).
   * The model must return JSON matching `schema` (a zod schema).
   * Invalid → we retry ONCE, feeding the validation error back to the model.
   * Still invalid → throw; callers then fall back or show a clean retry state.
   * Nothing unvalidated ever reaches the UI or the database.
   */
  async json(prompt, schema, opts = {}) {
    const system = {
      role: "system",
      content: "Respond ONLY with a valid JSON object. No markdown, no commentary.",
    };
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const raw = await this.#chat(
        [
          system,
          { role: "user", content: prompt },
          // On retry, tell the model exactly what was wrong with its last answer:
          ...(lastError
            ? [{ role: "user", content: `Your previous JSON was invalid: ${lastError}. Return corrected JSON only.` }]
            : []),
        ],
        // Low temperature = deterministic (good for extraction). Callers can
        // raise it when VARIETY matters (e.g. fresh quiz questions per attempt).
        { ...opts, jsonMode: true, temperature: opts.temperature ?? 0.2 }
      );
      try {
        return schema.parse(JSON.parse(raw)); // JSON.parse → syntax; schema.parse → shape
      } catch (e) {
        lastError = e.message.slice(0, 500);
      }
    }
    throw new Error(`AI returned invalid structured output after retry: ${lastError}`);
  }
}
