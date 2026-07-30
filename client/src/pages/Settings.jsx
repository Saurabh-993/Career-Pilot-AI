// Settings — AI tier selection, CLI bridge connection, live terminal panel.
import { useEffect, useRef, useState } from "react";

export default function Settings() {
  const [settings, setSettings] = useState(null); // { aiTier, bridgeCli }
  const [clis, setClis] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saved, setSaved] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showTerminal, setShowTerminal] = useState(false);
  const [lines, setLines] = useState([]);
  const termRef = useRef(null);
  const esRef = useRef(null);

  useEffect(() => {
    fetch("/api/ai/settings").then((r) => r.json()).then((d) => d.ok && setSettings(d.settings));
    return () => esRef.current?.close();
  }, []);

  // Live terminal via SSE (history replays on connect).
  useEffect(() => {
    if (!showTerminal) { esRef.current?.close(); return; }
    const es = new EventSource("/api/ai/bridge/stream");
    esRef.current = es;
    es.onmessage = (e) => setLines((prev) => [...prev.slice(-400), JSON.parse(e.data)]);
    return () => es.close();
  }, [showTerminal]);

  useEffect(() => {
    termRef.current?.scrollTo(0, termRef.current.scrollHeight); // auto-scroll
  }, [lines]);

  async function detect() {
    setDetecting(true);
    try {
      const d = await (await fetch("/api/ai/bridge/detect")).json();
      if (d.ok) setClis(d.clis);
    } finally { setDetecting(false); }
  }

  async function save(next) {
    setSettings(next);
    setSaved(false);
    const res = await fetch("/api/ai/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
    });
    if ((await res.json()).ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  async function testBridge() {
    setTesting(true);
    setTestResult(null);
    setShowTerminal(true); // watch it work live
    try {
      const res = await fetch("/api/ai/bridge/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cli: settings.bridgeCli }),
      });
      // Read as TEXT first: an empty body (server restarted / proxy dropped the
      // long request) would make res.json() throw a confusing parse error.
      const raw = await res.text();
      if (!raw.trim()) {
        setTestResult({
          ok: false,
          text: "No response from the server — it likely restarted or the request took too long. Check the server terminal, then retry.",
        });
        return;
      }
      const d = JSON.parse(raw);
      setTestResult(d.ok ? { ok: true, text: d.message } : { ok: false, text: d.error });
    } catch (e) {
      setTestResult({ ok: false, text: e.message });
    } finally { setTesting(false); }
  }

  if (!settings) return <p className="mt-8 animate-pulse text-sm text-accent">Loading settings…</p>;

  return (
    <div className="mt-4 max-w-3xl">
      <h2 className="mb-5 text-2xl font-extrabold tracking-tight">Settings</h2>

      {/* ---- AI tier ---- */}
      <div className="bento mb-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-soft">AI Provider</p>
        <p className="mb-4 text-xs text-soft">
          Who does the heavy AI work (question sets, roadmaps, deep analysis). Light tasks always use Groq.
        </p>
        <div className="space-y-2.5">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 ${settings.aiTier === "groq" ? "border-accent bg-accent/5" : "border-line"}`}>
            <input type="radio" checked={settings.aiTier === "groq"} className="mt-0.5 accent-current"
                   onChange={() => save({ ...settings, aiTier: "groq" })} />
            <span>
              <span className="block text-sm font-semibold">Groq free tier (default)</span>
              <span className="text-xs text-soft">Fast, free, zero setup. Llama 3.3 70B.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 ${settings.aiTier === "key" ? "border-accent bg-accent/5" : "border-line"}`}>
            <input type="radio" checked={settings.aiTier === "key"} className="mt-0.5 accent-current"
                   onChange={() => save({ ...settings, aiTier: "key" })} />
            <span>
              <span className="block text-sm font-semibold">My own API key — switch model</span>
              <span className="text-xs text-soft">
                Use your own Groq / OpenAI / Gemini key and pick the model. Encrypted at rest, never shown again.
              </span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 ${settings.aiTier === "bridge" ? "border-accent bg-accent/5" : "border-line"}`}>
            <input type="radio" checked={settings.aiTier === "bridge"} className="mt-0.5 accent-current"
                   onChange={() => save({ ...settings, aiTier: "bridge" })} />
            <span>
              <span className="block text-sm font-semibold">CLI Agent Bridge — use your subscription</span>
              <span className="text-xs text-soft">
                Got Claude / Gemini / ChatGPT via a CLI subscription (no API key)? It runs in a sandboxed
                folder, does the heavy generation, and Groq automatically takes over if it fails.
              </span>
            </span>
          </label>
        </div>
        {saved && <p className="mt-2 text-xs text-emerald-500">✓ Saved</p>}
      </div>

      {/* ---- Own API key ---- */}
      {settings.aiTier === "key" && (
        <div className="bento mb-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Your API key</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-soft">Vendor</label>
              <select value={settings.keyVendor || ""}
                      onChange={(e) => setSettings({ ...settings, keyVendor: e.target.value })}
                      className="w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none">
                <option value="">Choose…</option>
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-soft">Model (blank = default)</label>
              <input value={settings.keyModel || ""} placeholder="e.g. gpt-4o, gemini-2.0-flash"
                     onChange={(e) => setSettings({ ...settings, keyModel: e.target.value })}
                     className="w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-soft">
                API key {settings.keySet && <span className="text-emerald-500">(already saved ✓)</span>}
              </label>
              <input type="password" value={apiKeyInput} placeholder={settings.keySet ? "•••••• (type to replace)" : "sk-…"}
                     onChange={(e) => setApiKeyInput(e.target.value)}
                     className="w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
          </div>
          <button
            onClick={async () => { await save({ ...settings, apiKey: apiKeyInput || undefined }); setApiKeyInput(""); }}
            disabled={!settings.keyVendor || (!settings.keySet && !apiKeyInput)}
            className="mt-3 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
            Save key settings
          </button>
        </div>
      )}

      {/* ---- Bridge connection ---- */}
      {settings.aiTier === "bridge" && (
        <div className="bento mb-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Connect a CLI agent</p>
          <button onClick={detect} disabled={detecting}
                  className="mb-3 rounded-xl border border-line px-3.5 py-2 text-xs font-semibold text-soft hover:text-strong disabled:opacity-50">
            {detecting ? "Detecting…" : "Detect installed CLIs"}
          </button>

          {clis && (
            <div className="mb-3 space-y-2">
              {clis.map((c) => (
                <label key={c.name}
                       className={`flex items-center gap-3 rounded-xl border p-3 ${!c.available ? "opacity-50" : "cursor-pointer"} ${settings.bridgeCli === c.name ? "border-accent bg-accent/5" : "border-line"}`}>
                  <input type="radio" disabled={!c.available} checked={settings.bridgeCli === c.name}
                         onChange={() => save({ ...settings, bridgeCli: c.name })} className="accent-current" />
                  <span className="text-sm font-semibold capitalize">{c.name}</span>
                  <span className="ml-auto text-xs text-soft">
                    {c.available ? c.version ?? "installed" : "not installed"}
                  </span>
                </label>
              ))}
              {clis.every((c) => !c.available) && (
                <p className="text-xs text-amber-500">
                  No CLIs found. Install one (e.g. <code className="text-accent">npm i -g @anthropic-ai/claude-code</code>) and
                  log in with your subscription, then detect again.
                </p>
              )}
            </div>
          )}

          {settings.bridgeCli && (
            <div className="flex items-center gap-3">
              <button onClick={testBridge} disabled={testing}
                      className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {testing ? "Testing (can take a minute)…" : "Test bridge"}
              </button>
              {testResult && (
                <p className={`text-xs ${testResult.ok ? "text-emerald-500" : "text-red-400"}`}>
                  {testResult.ok ? `✓ ${testResult.text}` : `✗ ${testResult.text}`}
                </p>
              )}
            </div>
          )}
          <p className="mt-3 text-[11px] text-soft">
            Sandbox: the agent can only read/write inside the <code>bridge/</code> folder. "Heavy Mode"
            (letting it edit real files, with diff approval) arrives with the desktop app.
          </p>
          <p className="mt-2 text-[11px] text-soft">
            <strong>Note:</strong> the CLI must be logged in (run it once in a terminal) and its plan must
            still be supported by the vendor. Google deprecated Gemini CLI's free individual tier
            (<code>UNSUPPORTED_CLIENT</code>) — Claude Code is the most reliable option today. If no CLI
            works, nothing breaks: Groq or your own API key keeps handling everything.
          </p>
        </div>
      )}

      {/* ---- Terminal panel ---- */}
      <div className="bento">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-soft">Bridge terminal</p>
          <button onClick={() => setShowTerminal((v) => !v)}
                  className="rounded-xl border border-line px-3 py-1.5 text-xs text-soft hover:text-strong">
            {showTerminal ? "Hide" : "Show"}
          </button>
        </div>
        {showTerminal && (
          <div ref={termRef}
               className="mt-3 h-64 overflow-y-auto rounded-xl bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-400">
            {lines.length === 0 && <p className="text-soft">— waiting for bridge activity —</p>}
            {lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
