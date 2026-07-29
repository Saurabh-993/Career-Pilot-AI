// Phase 0 Dashboard: proves the client ↔ server connection works.
// Phase 1 replaces this with real metrics (strengths, ATS, in-demand tech).
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [health, setHealth] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    // Thanks to the Vite proxy, "/api/health" reaches the Express server.
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Dashboard</h2>
      <p className="text-soft text-sm mb-6">Resume upload and live metrics arrive in Phase 1.</p>

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
            <li className="text-soft">Uptime: {health.uptimeSeconds}s</li>
          </ul>
        )}
      </div>
    </div>
  );
}
