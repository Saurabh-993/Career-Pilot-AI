// Phase 0 Dashboard: proves the client ↔ server connection works.
// Phase 1 replaces this with real metrics (strengths, ATS, in-demand tech).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import UploadCard from "../components/UploadCard.jsx";
import MetricsPanel from "../components/MetricsPanel.jsx";
import { useAppStore } from "../store/useAppStore.js";

export default function Dashboard() {
  const [health, setHealth] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const resumeReady = useAppStore((s) => s.resumeReady);
  const profiling = useAppStore((s) => s.profiling);
  const profilingSkipped = useAppStore((s) => s.profilingSkipped);
  const skipProfiling = useAppStore((s) => s.skipProfiling);

  useEffect(() => {
    // Re-check every 5s — a one-shot check can catch the server mid-restart
    // (node --watch restarts on every save) and then show "unreachable" forever.
    async function check() {
      try {
        const r = await fetch("/api/health");
        setHealth(await r.json());
        setError(null);
      } catch (e) {
        setHealth(null);
        setError(e.message);
      }
    }
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Dashboard</h2>
      <p className="text-soft text-sm mb-6">Upload your resume to begin. Live metrics arrive in the next steps.</p>

      <div className="mb-6">
        <UploadCard />
      </div>

      {/* Profiling banner — verify level via MCQs, or skip (PLAN.md flow) */}
      {resumeReady && !profiling && !profilingSkipped && (
        <div className="mb-6 max-w-3xl rounded-xl border border-accent/40 bg-surface p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Verify your level</p>
            <p className="text-xs text-soft">
              10 quick MCQs generated from your resume — makes your roadmaps and prep sharper.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link to="/profiling" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-ink hover:opacity-90">
              Start profiling
            </Link>
            <button onClick={skipProfiling} className="rounded-lg border border-line px-3 py-1.5 text-xs text-soft hover:text-strong">
              Skip — I know my level
            </button>
          </div>
        </div>
      )}

      {profiling && (
        <div className="mb-6 max-w-3xl rounded-xl border border-line bg-surface px-5 py-3 flex items-center justify-between">
          <p className="text-sm">
            Verified level:{" "}
            <span className="font-semibold text-accent">{profiling.level ?? `${profiling.score}/100`}</span>
            {profiling.level && <span className="text-soft"> · {profiling.score}/100</span>}
          </p>
          <Link to="/profiling" className="text-xs text-accent hover:underline">Retake</Link>
        </div>
      )}

      <div className="mb-6 max-w-3xl">
        <MetricsPanel />
      </div>

      <div className="max-w-md rounded-xl border border-line bg-surface p-5">
        <h3 className="font-medium mb-3">System status</h3>
        {error && <p className="text-red-400 text-sm">Backend unreachable: {error} — is the server running?</p>}
        {!error && !health && <p className="text-soft text-sm">Checking…</p>}
        {health && (
          <ul className="space-y-2 text-sm">
            <li>API server: <span className="text-emerald-400">● connected</span></li>
            <li>
              Groq key:{" "}
              {health.groqKeyConfigured ? (
                <span className="text-emerald-400">● configured</span>
              ) : (
                <span className="text-amber-400">● missing — add it to server/.env</span>
              )}
            </li>
            <li>
              MongoDB:{" "}
              {health.mongoConnected ? (
                <span className="text-emerald-400">● connected</span>
              ) : (
                <span className="text-amber-400">● not connected — run `npm run db:up`</span>
              )}
            </li>
            <li className="text-soft">Uptime: {health.uptimeSeconds}s</li>
          </ul>
        )}
      </div>
    </div>
  );
}
