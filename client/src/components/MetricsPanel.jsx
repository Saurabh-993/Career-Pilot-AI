// AI career dashboard — consumes the SSE stream and renders the metrics.
// EventSource = the browser side of SSE: one long-lived connection where the
// server pushes named events ("progress", "done", "error") as they happen.
import { useEffect, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAppStore } from "../store/useAppStore.js";

export default function MetricsPanel() {
  const resumeId = useAppStore((s) => s.resumeId);
  const resumeReady = useAppStore((s) => s.resumeReady);
  const [phase, setPhase] = useState("idle"); // idle | streaming | done | error
  const [stage, setStage] = useState("");
  const [dash, setDash] = useState(null);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  function start(refresh = false) {
    if (!resumeId) return;
    esRef.current?.close();
    setPhase("streaming");
    setError(null);
    const es = new EventSource(
      `/api/analysis/dashboard/${resumeId}/stream${refresh ? "?refresh=1" : ""}`
    );
    esRef.current = es;
    es.addEventListener("progress", (e) => setStage(JSON.parse(e.data).stage));
    es.addEventListener("done", (e) => {
      setDash(JSON.parse(e.data));
      setPhase("done");
      es.close();
    });
    es.addEventListener("error", (e) => {
      // our named "error" event carries JSON; connection-level errors don't
      if (e.data) setError(JSON.parse(e.data).message);
      else setError("Connection lost — is the server running?");
      setPhase("error");
      es.close();
    });
  }

  // Auto-generate as soon as an analyzed resume is available.
  useEffect(() => {
    if (resumeId && resumeReady) start();
    return () => esRef.current?.close(); // cleanup on unmount
  }, [resumeId, resumeReady]);

  if (!resumeId || !resumeReady) return null;

  if (phase === "streaming")
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm text-accent animate-pulse">{stage || "Starting analysis…"}</p>
      </div>
    );

  if (phase === "error")
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm text-red-400 mb-2">{error}</p>
        <button onClick={() => start()} className="text-xs text-accent hover:underline">
          Try again
        </button>
      </div>
    );

  if (phase !== "done" || !dash) return null;

  const score = Math.round(dash.atsScore);
  const ring = 2 * Math.PI * 44; // circumference for the score ring

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Career insights</h3>
        <button onClick={() => start(true)} className="text-xs text-accent hover:underline">
          ↻ Regenerate
        </button>
      </div>

      {/* ATS score ring + tips */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5 flex items-center gap-5">
          <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90 shrink-0">
            <circle cx="52" cy="52" r="44" fill="none" strokeWidth="8" className="stroke-line" />
            <circle
              cx="52" cy="52" r="44" fill="none" strokeWidth="8" strokeLinecap="round"
              className="stroke-accent transition-all duration-700"
              strokeDasharray={ring} strokeDashoffset={ring * (1 - score / 100)}
            />
          </svg>
          <div>
            <p className="text-3xl font-bold">{score}<span className="text-base text-soft">/100</span></p>
            <p className="text-sm text-soft">ATS readiness score</p>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-sm font-medium mb-2">Improve your ATS score</p>
          <ul className="space-y-1.5">
            {dash.atsTips.map((t, i) => (
              <li key={i} className="text-xs text-soft leading-relaxed">• {t}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Strengths & gaps */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["Strengths", dash.strengths, "text-emerald-400"],
          ["Gaps to close", dash.gaps, "text-amber-400"],
        ].map(([title, items, color]) => (
          <div key={title} className="rounded-xl border border-line bg-surface p-5">
            <p className={`text-sm font-medium mb-3 ${color}`}>{title}</p>
            <ul className="space-y-2.5">
              {items.map((it, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium">{it.title}</span>
                  <span className="text-soft"> — {it.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* In-demand tech (Recharts) */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-medium mb-1">Technology in demand</p>
        <p className="text-xs text-soft mb-4">
          <span className="text-accent">■</span> you have it&nbsp;&nbsp;
          <span className="text-soft">■</span> worth learning
        </p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dash.inDemandTech} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category" dataKey="name" width={150}
                tick={{ fill: "rgb(var(--soft))", fontSize: 10 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgb(var(--line) / 0.3)" }}
                contentStyle={{
                  background: "rgb(var(--ink))", border: "1px solid rgb(var(--line))",
                  borderRadius: 8, fontSize: 12, color: "rgb(var(--strong))",
                }}
              />
              <Bar dataKey="demand" radius={[0, 4, 4, 0]} barSize={14}>
                {dash.inDemandTech.map((t, i) => (
                  <Cell key={i} fill={t.hasSkill ? "rgb(var(--accent))" : "rgb(var(--soft) / 0.45)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Role fit */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-medium mb-3">Role fit</p>
        <div className="space-y-3">
          {dash.roleFit.map((r) => (
            <div key={r.role}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{r.role}</span>
                <span className="text-soft">{Math.round(r.matchPercent)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-line overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700"
                  style={{ width: `${r.matchPercent}%` }}
                />
              </div>
              <p className="text-xs text-soft mt-1">{r.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
