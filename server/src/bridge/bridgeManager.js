// CLI Agent Bridge — runs a subscription CLI (claude/gemini/codex) inside a
// sandboxed directory using a file-based protocol (PLAN.md §5):
//   bridge/context.md  ← we write background
//   bridge/inbox/task-N.json  ← we write the task
//   bridge/outbox/task-N.json ← the agent writes JSON, we zod-validate it
// The CLI runs with cwd = bridge/ and is instructed (AGENT.md) to touch
// nothing else. Its stdout streams to a terminal buffer for the UI panel.

import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BRIDGE_DIR = path.resolve(__dirname, "../../../bridge");

// --- Terminal stream (SSE subscribes to this) ---
export const terminal = new EventEmitter();
terminal.setMaxListeners(50);
const buffer = [];
function log(line) {
  const entry = `[${new Date().toLocaleTimeString()}] ${line}`;
  buffer.push(entry);
  if (buffer.length > 400) buffer.shift();
  terminal.emit("line", entry);
}
export const terminalBuffer = () => [...buffer];
/** Wipe history so each run's output is unambiguous (old lines confused debugging). */
export function clearTerminal() {
  buffer.length = 0;
  terminal.emit("line", "— new task —");
}

// --- CLI registry — STDIN→STDOUT protocol (v3).
// v1 (write files) needed per-CLI permission flags that break across versions.
// v2 passed the prompt as an ARGUMENT — fatal on Windows: npm CLIs are .cmd
// shims requiring shell:true, and cmd.exe mangles long multi-line arguments
// containing quotes/braces, so the CLI saw garbage flags and printed help.
// v3 passes ONLY short flags on the command line and pipes the prompt through
// stdin — nothing for the shell to mangle. Portable across CLIs and versions.
// v4: each CLI gets an ORDERED LIST of strategies. Windows .cmd shims don't
// always forward piped stdin, and flags differ per version — so we try
// stdin first, then a "read the prompt from a file" variant whose command
// line stays short (nothing for cmd.exe to mangle). First one that returns
// valid JSON wins; the winner is remembered for the session.
const IS_WIN = process.platform === "win32";
const FILE_HINT = "Read the file prompt.md in the current directory and do exactly what it says.";

const CLIS = {
  claude: {
    detect: ["claude", ["--version"]],
    strategies: [
      { name: "stdin", cmd: "claude", args: ["-p"], stdin: true },
      { name: "file", cmd: "claude", args: ["-p", FILE_HINT], stdin: false },
    ],
  },
  gemini: {
    detect: ["gemini", ["--version"]],
    strategies: [
      { name: "stdin", cmd: "gemini", args: [], stdin: true },
      // note: gemini 0.51 prints help for "-p <text>" — stdin is its working path
    ],
  },
  codex: {
    detect: ["codex", ["--version"]],
    strategies: [
      { name: "stdin", cmd: "codex", args: ["exec", "-"], stdin: true },
      { name: "file", cmd: "codex", args: ["exec", FILE_HINT], stdin: false },
    ],
  },
};

const workingStrategy = {}; // cli → strategy name that worked this session

/**
 * Strip ANSI escape sequences.
 * BUG WE HIT: matching only the `[32m` part left the invisible ESC (\\x1B) byte
 * behind. ESC is illegal inside JSON, so parsing died at "line 2 column 3" on
 * colourized CLI output. The ESC itself must be part of the pattern.
 */
const stripAnsi = (s) =>
  s
    .replace(/\x1B\[[0-9;?]*[ -\/]*[@-~]/g, "") // CSI sequences (colours, cursor moves)
    .replace(/\x1B[@-Z\\-_]/g, ""); // other escape sequences

/** Control characters can never appear raw inside JSON — drop them. */
const stripControls = (s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

const LOGIN_RE = /not logged in|please run \/login|login required|not authenticated|please sign in/i;
// If the CLI printed its usage/help screen, our invocation was wrong — say so
// plainly instead of the confusing "no JSON object found".
const HELP_RE = /(^|\n)\s*(usage:|options:|commands:)|--help\s+Show help/i;

/**
 * Pull one parseable JSON object out of chatty CLI output.
 * CLIs wrap answers in banners, markdown fences and colour codes, so we clean
 * aggressively, then walk BRACE DEPTH to find the first complete object
 * (lastIndexOf("}") breaks when the CLI prints anything after the JSON).
 */
function extractJson(raw) {
  let text = stripControls(stripAnsi(raw))
    .replace(/\u0060\u0060\u0060(?:json)?/gi, "") // markdown fences
    .trim();
  const start = text.indexOf("{");
  if (start === -1) throw new Error("no JSON object found in CLI output");

  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === String.fromCharCode(34)) inStr = false;
      continue;
    }
    if (c === String.fromCharCode(34)) inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      const candidate = text.slice(start, i + 1).replace(/,(\s*[}\]])/g, "$1"); // trailing commas
      return candidate;
    }
  }
  throw new Error("JSON object in CLI output is incomplete (was it truncated?)");
}

export function detectClis() {
  return Object.entries(CLIS).map(([name, def]) => {
    try {
      const r = spawnSync(def.detect[0], def.detect[1], {
        timeout: 8000, shell: IS_WIN, encoding: "utf8",
      });
      return {
        name,
        available: r.status === 0,
        version: r.status === 0 ? (r.stdout || "").trim().split("\n")[0] : null,
      };
    } catch {
      return { name, available: false, version: null };
    }
  });
}

function ensureBridge() {
  fs.mkdirSync(path.join(BRIDGE_DIR, "inbox"), { recursive: true });
  fs.mkdirSync(path.join(BRIDGE_DIR, "outbox"), { recursive: true });
}

/** Run ONE strategy. Never rejects on CLI failure — returns what happened. */
function spawnStrategy(strategy, prompt, timeoutMs) {
  return new Promise((resolve) => {
    // The prompt always lands in bridge/prompt.md too (the "file" strategy
    // reads it; it's also a transparency artifact for the user).
    fs.writeFileSync(path.join(BRIDGE_DIR, "prompt.md"), prompt);

    log(`▶ ${strategy.cmd} [${strategy.name}] — ${prompt.length} char prompt`);
    let child;
    try {
      child = spawn(strategy.cmd, strategy.args, { cwd: BRIDGE_DIR, shell: IS_WIN });
    } catch (e) {
      log(`✖ spawn failed: ${e.message}`);
      return resolve({ output: "", error: e.message });
    }

    let output = "";
    const killer = setTimeout(() => {
      log(`⏱ timed out after ${Math.round(timeoutMs / 1000)}s — killing`);
      child.kill("SIGKILL");
    }, timeoutMs);

    if (strategy.stdin) {
      child.stdin.on("error", () => {}); // .cmd shims can drop the pipe — not fatal
      try {
        child.stdin.write(prompt);
        child.stdin.end();
      } catch { /* handled by the error listener above */ }
    } else {
      child.stdin.end(); // no input: prevents the CLI waiting on a TTY forever
    }

    const stream = (data) => {
      const s = stripAnsi(String(data));
      output += s;
      s.split("\n").filter(Boolean).forEach((l) => log(l.slice(0, 300)));
    };
    child.stdout.on("data", stream);
    child.stderr.on("data", stream);
    child.on("error", (e) => {
      clearTimeout(killer);
      log(`✖ process error: ${e.message}`);
      resolve({ output, error: e.message });
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      log(`■ exited with code ${code} (${output.length} chars of output)`);
      resolve({ output, code });
    });
  });
}

/**
 * Run one task through the bridge (stdout protocol): full prompt goes in,
 * the CLI prints ONE JSON object, we extract + zod-validate it. One
 * self-correcting retry, then throw — callers fall back to Groq.
 * context.md + last-output.txt are still written for transparency.
 */
export async function runBridgeTask({ cli, instruction, schema, contextMd = "", timeoutMs = 180000 }) {
  if (!CLIS[cli]) throw new Error(`Unknown CLI "${cli}"`);
  ensureBridge();
  clearTerminal(); // fresh log per task — stale lines made failures ambiguous
  fs.writeFileSync(path.join(BRIDGE_DIR, "context.md"), contextMd || "(no extra context for this task)");

  const buildPrompt = (validationError) =>
    `You are CareerPilot's heavy-generation AI running non-interactively.\n\n` +
    (contextMd ? `CONTEXT:\n${contextMd}\n\n` : "") +
    `TASK:\n${instruction}\n\n` +
    `OUTPUT RULES: respond with ONLY one valid JSON object. No markdown fences, no commentary before or after — your entire response must parse with JSON.parse().` +
    (validationError ? `\n\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION: ${validationError}\nFix exactly that.` : "");

  // Try the known-good strategy first, then the others.
  const all = CLIS[cli].strategies;
  const ordered = workingStrategy[cli]
    ? [...all].sort((a) => (a.name === workingStrategy[cli] ? -1 : 1))
    : all;

  const problems = [];
  for (const strategy of ordered) {
    let validationError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { output, error } = await spawnStrategy(strategy, buildPrompt(validationError), timeoutMs);
      fs.writeFileSync(path.join(BRIDGE_DIR, "last-output.txt"), output.slice(-20000));

      if (LOGIN_RE.test(output))
        throw new Error(
          `${cli} CLI is not logged in. Open a terminal, run \`${cli}\`, complete its login flow, then test again.`
        );
      if (error) { problems.push(`${strategy.name}: ${error}`); break; }
      if (!output.trim()) { problems.push(`${strategy.name}: produced no output`); break; }
      if (HELP_RE.test(output) && !output.includes("{")) {
        problems.push(`${strategy.name}: printed its help screen (invocation not supported by this version)`);
        break;
      }

      try {
        const parsed = schema.parse(JSON.parse(extractJson(output)));
        workingStrategy[cli] = strategy.name; // remember what works
        log(`✔ validated via "${strategy.name}" strategy`);
        return parsed;
      } catch (e) {
        validationError = (e.message || String(e)).slice(0, 400);
        log(`✖ ${strategy.name} attempt ${attempt}: ${validationError}`);
        if (attempt === 2) problems.push(`${strategy.name}: ${validationError}`);
      }
    }
  }
  throw new Error(
    `${cli} bridge failed. Tried: ${problems.join(" | ")}. Raw output saved to bridge/last-output.txt. ` +
      `Groq will keep handling your requests meanwhile.`
  );
}
