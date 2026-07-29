// Career metrics as bento grid cells (rendered inside Dashboard's grid).
// Consumes the SSE stream: server pushes progress → done | error.
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
    const es = new EventSource(`/api/analysis/dashboard/${resumeId}/stream${refresh ? "?refresh=1" : ""}`);
    esRef.current = es;
    es.addEventListener("progress", (e) => setStage(JSON.parse(e.data).stage));
    es.addEventListener("done", (e) => { setDash(JSON.parse(e.data)); setPhase("done"); es.close(); });
    es.addEventListener("error", (e) => {
      setError(e.data ? JSON.parse(e.data).message : "Connection lost — is the server running?");
      setPhase("error");
      es.close();
    });
  }

  useEffect(() => {
    if (resumeId && resumeReady) start();
    return () => esRef.current?.close();
  }, [resumeId, resumeReady]);

  if (!resumeId || !resumeReady) return null;

  if (phase === "streaming")
    return (
      <div className="bento order-2 col-span-full !py-4">
        <p className="animate-pulse text-sm text-accent">{stage || "Starting analysis…"}</p>
      </div>
    );

  if (phase === "error")
    return (
      <div className="bento order-2 col-span-full !py-4">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={() => start()} className="mt-1 text-xs font-medium text-accent hover:underline">Try again</button>
      </div>
    );

  if (phase !== "done" || !dash) return null;

  const score = Math.round(dash.atsScore);
  const ring = 2 * Math.PI * 46;

  return (
    <>
      {/* ATS score — top-right, first thing the user sees */}
      <div className="bento bento-hover order-2 md:col-span-3 xl:col-span-5 flex items-center gap-6">
        <svg width="116" height="116" viewBox="0 0 116 116" className="-rotate-90 shrink-0">
          <circle cx="58" cy="58" r="46" fill="none" strokeWidth="9" className="stroke-line" />
          <circle
            cx="58" cy="58" r="46" fill="none" strokeWidth="9" strokeLinecap="round"
            className="stroke-accent transition-all duration-700"
            strokeDasharray={ring} strokeDashoffset={ring * (1 - score / 100)}
          />
        </svg>
        <div>
          <p className="text-4xl font-extrabold tracking-tight">
            {score}<span className="text-base font-medium text-soft">/100</span>
          </p>
          <p className="mt-0.5 text-xs font-medium text-soft">ATS readiness</p>
          <button onClick={() => start(true)} className="mt-2 text-[11px] font-medium text-accent hover:underline">
            ↻ Regenerate insights
          </button>
        </div>
      </div>

      {/* Strengths */}
      <div className="bento bento-hover order-5 md:col-span-3 xl:col-span-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-500">Strengths</p>
        <ul className="space-y-3">
          {dash.strengths.map((it, i) => (
            <li key={i} className="text-sm leading-relaxed">
              <span className="font-semibold">{it.title}</span>
              <span className="text-soft"> — {it.detail}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Gaps */}
      <div className="bento bento-hover order-6 md:col-span-3 xl:col-span-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-500">Gaps to close</p>
        <ul className="space-y-3">
          {dash.gaps.map((it, i) => (
            <li key={i} className="text-sm leading-relaxed">
              <span className="font-semibold">{it.title}</span>
              <span className="text-soft"> — {it.detail}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ATS improvement tips */}
      <div className="bento bento-hover order-7 md:col-span-3 xl:col-span-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent">Boost your ATS score</p>
        <ul className="space-y-2.5">
          {dash.atsTips.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-soft">
              <span className="font-bold text-accent">{i + 1}.</span> {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Tech demand chart */}
      <div className="bento bento-hover order-8 md:col-span-6 xl:col-span-8">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-xs font-bold uppercase tracking-wider">Technology in demand</p>
          <p className="text-[10px] text-soft">
            <span className="text-accent">●</span> you have it&nbsp;&nbsp;<span>●</span> worth learning
          </p>
        </div>
        <div style={{ height: 250 }}>
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
                  background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))",
                  borderRadius: 12, fontSize: 12, color: "rgb(var(--strong))",
                }}
              />
              <Bar dataKey="demand" radius={[0, 6, 6, 0]} barSize={13}>
                {dash.inDemandTech.map((t, i) => (
                  <Cell key={i} fill={t.hasSkill ? "rgb(var(--accent))" : "rgb(var(--soft) / 0.35)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Role fit */}
      <div className="bento bento-hover order-9 md:col-span-6 xl:col-span-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider">Role fit</p>
        <div className="space-y-4">
          {dash.roleFit.map((r) => (
            <div key={r.role}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">{r.role}</span>
                <span className="text-soft">{Math.round(r.matchPercent)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${r.matchPercent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
