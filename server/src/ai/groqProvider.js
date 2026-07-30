// OpenAICompatProvider — works with ANY OpenAI-compatible chat API
// (Groq, OpenAI, Google's Gemini compat endpoint…). GroqProvider (Tier 1,
// free default) is just a preconfigured instance of it; Tier 2 (user's own
// key) builds one from Settings.

export class OpenAICompatProvider {
  constructor({ baseUrl, model, apiKey, name = "ai" }) {
    if (!apiKey) throw new Error(`${name}: API key is missing`);
    this.baseUrl = baseUrl;
    this.model = model;
    this.apiKey = apiKey;
    this.name = name;
  }

  // Low-level call shared by complete() and json().
  async #chat(messages, { jsonMode = false, temperature = 0.7 } = {}) {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        // jsonMode forces the model to output syntactically valid JSON only
        ...(jsonMode && { response_format: { type: "json_object" } }),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`${this.name} API error ${res.status}: ${body.slice(0, 300)}`);
      err.status = res.status === 429 ? 429 : 502; // 429 = rate-limited
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

// Tier 1 — free default: Groq's OpenAI-compatible endpoint + Llama 3.3 70B.
export class GroqProvider extends OpenAICompatProvider {
  constructor(apiKey) {
    if (!apiKey)
      throw new Error("GROQ_API_KEY is missing — copy server/.env.example to server/.env and add your key");
    super({
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      apiKey,
      name: "groq",
    });
  }
}
