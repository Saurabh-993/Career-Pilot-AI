// Practice — three MCQ modes with adaptive difficulty + "interview in N days"
// prep plans with day-wise checklists.
import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore.js";
import McqRunner from "../components/McqRunner.jsx";

const daysLeft = (date) => Math.max(0, Math.ceil((new Date(date) - Date.now()) / 86400000));

const KIND_COLOR = {
  study: "text-accent", practice: "text-emerald-500", mock: "text-purple-400",
  revision: "text-amber-500", apply: "text-soft",
};

export default function Practice() {
  const resumeId = useAppStore((s) => s.resumeId);
  const resumeReady = useAppStore((s) => s.resumeReady);

  const [tab, setTab] = useState("practice"); // practice | plans
  // Practice state
  const [view, setView] = useState("menu"); // menu | loading | run | result
  const [company, setCompany] = useState("");
  const [set, setSet] = useState(null); // { setId, questions }
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  // Prep plans state
  const [plans, setPlans] = useState([]);
  const [planCompany, setPlanCompany] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  const [openPlan, setOpenPlan] = useState(null); // expanded plan id

  async function loadHistory() {
    try {
      const res = await fetch(`/api/practice/history/${resumeId}`);
      const data = await res.json();
      if (data.ok) setHistory(data);
    } catch { /* non-critical */ }
  }
  async function loadPlans() {
    try {
      const res = await fetch(`/api/practice/prep-plans/${resumeId}`);
      const data = await res.json();
      if (data.ok) setPlans(data.plans);
    } catch { /* non-critical */ }
  }
  useEffect(() => {
    if (resumeId && resumeReady) { loadHistory(); loadPlans(); }
  }, [resumeId, resumeReady]);

  async function startSet(mode) {
    setView("loading");
    setError(null);
    try {
      const res = await fetch("/api/practice/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, mode, company: mode === "company" ? company : undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSet(data);
      setView("run");
    } catch (e) {
      setError(e.message);
      setView("menu");
    }
  }

  async function answer(qIdx, answerIdx) {
    const res = await fetch("/api/practice/attempt", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: set.setId, qIdx, answerIdx }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data;
  }

  async function finishSet() {
    const res = await fetch("/api/practice/finish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: set.setId }),
    });
    const data = await res.json();
    setResult(data);
    setView("result");
    loadHistory();
  }

  async function createPlan() {
    setPlanBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/practice/prep-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, company: planCompany, interviewDate: planDate }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setPlanCompany(""); setPlanDate("");
      await loadPlans();
      setOpenPlan(data.plan._id);
    } catch (e) { setError(e.message); }
    finally { setPlanBusy(false); }
  }

  async function toggleTask(planId, day, task) {
    // Optimistic update — flip locally first, server confirms in background.
    setPlans((prev) => prev.map((p) => p._id === planId
      ? { ...p, done: { ...p.done, [`${day}-${task}`]: !p.done?.[`${day}-${task}`] } } : p));
    fetch("/api/practice/prep-plan/toggle", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, day, task }),
    }).catch(() => {});
  }

  if (!resumeReady)
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-extrabold tracking-tight">Practice</h2>
        <p className="mt-2 text-sm text-soft">Upload your resume on Home first — practice is personalized to it.</p>
      </div>
    );

  return (
    <div className="mt-4">
      <div className="mb-5 flex items-center gap-2">
        <h2 className="mr-4 text-2xl font-extrabold tracking-tight">Practice</h2>
        {[["practice", "Question sets"], ["plans", "Prep plans"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    tab === k ? "bg-accent/10 text-accent" : "text-soft hover:text-strong"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

      {/* ================= QUESTION SETS ================= */}
      {tab === "practice" && view === "menu" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
          {[
            ["standard", "Standard screening", "Aptitude, DSA, CS fundamentals and HR judgment — the classic tech screening mix."],
            ["company", "Company-specific", "Questions in the style and pattern of one company's actual interviews."],
            ["resume", "From my resume", "What an interviewer would ask after reading YOUR resume — projects included."],
          ].map(([mode, title, desc]) => (
            <div key={mode} className="bento bento-hover flex flex-col md:col-span-2 xl:col-span-4">
              <p className="text-sm font-bold">{title}</p>
              <p className="mt-1.5 mb-4 text-xs leading-relaxed text-soft">{desc}</p>
              {mode === "company" && (
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name…"
                       className="mb-3 rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent" />
              )}
              <button onClick={() => startSet(mode)} disabled={mode === "company" && !company.trim()}
                      className="mt-auto rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                Start 10 questions →
              </button>
            </div>
          ))}

          {/* History + adaptive stats */}
          {history?.sets?.length > 0 && (
            <>
              <div className="bento md:col-span-3 xl:col-span-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Recent sets</p>
                <div className="space-y-2">
                  {history.sets.slice(0, 6).map((s) => (
                    <div key={s._id} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{s.mode}{s.company ? ` · ${s.company}` : ""}</span>
                      <span className={`font-bold ${s.score >= 70 ? "text-emerald-500" : s.score >= 40 ? "text-amber-500" : "text-red-400"}`}>
                        {s.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bento md:col-span-3 xl:col-span-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-soft">Topic accuracy</p>
                <p className="mb-3 text-[11px] text-soft">Weak topics get more questions next time — that's the adaptive part.</p>
                <div className="space-y-2">
                  {Object.entries(history.topicAccuracy).slice(0, 8).map(([topic, t]) => {
                    const pct = Math.round((t.correct / t.total) * 100);
                    return (
                      <div key={topic}>
                        <div className="mb-0.5 flex justify-between text-xs">
                          <span>{topic}</span><span className="text-soft">{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-line">
                          <div className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                               style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "practice" && view === "loading" && (
        <p className="animate-pulse text-sm text-accent">Generating your personalized set…</p>
      )}

      {tab === "practice" && view === "run" && set && (
        <McqRunner questions={set.questions} onAnswer={answer} onFinish={finishSet} title="Practice set" />
      )}

      {tab === "practice" && view === "result" && result && (
        <div className="max-w-xl">
          <h3 className="text-lg font-bold">Set complete</h3>
          <p className="my-4 text-5xl font-extrabold">{result.score}<span className="text-xl text-soft">%</span></p>
          <div className="bento mb-5">
            {Object.entries(result.byTopic).map(([topic, t]) => (
              <div key={topic} className="flex justify-between border-b border-line py-1.5 text-sm last:border-0">
                <span>{topic}</span>
                <span className={t.correct === t.total ? "text-emerald-400" : t.correct === 0 ? "text-red-400" : "text-amber-400"}>
                  {t.correct}/{t.total}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => { setView("menu"); setSet(null); setResult(null); }}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Practice again
          </button>
        </div>
      )}

      {/* ================= PREP PLANS ================= */}
      {tab === "plans" && (
        <div>
          <div className="bento mb-5 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-soft">Company</label>
              <input value={planCompany} onChange={(e) => setPlanCompany(e.target.value)} placeholder="e.g. Amazon"
                     className="w-52 rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-soft">Interview date</label>
              <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)}
                     min={new Date().toISOString().split("T")[0]}
                     className="rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <button onClick={createPlan} disabled={planBusy || !planCompany.trim() || !planDate}
                    className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {planBusy ? "Building your plan…" : "Build my prep plan"}
            </button>
          </div>

          {plans.length === 0 && (
            <p className="text-sm text-soft">No prep plans yet — got an interview coming? Build a day-wise plan above.</p>
          )}

          <div className="space-y-4">
            {plans.map((p) => {
              const dl = daysLeft(p.interviewDate);
              const total = p.plan.days.reduce((n, d) => n + d.tasks.length, 0);
              const doneCount = Object.values(p.done ?? {}).filter(Boolean).length;
              const todayIdx = Math.min(p.plan.days.length - 1, Math.max(0, p.plan.days.length - dl - (dl === 0 ? 0 : 0)) );
              const isOpen = openPlan === p._id;
              return (
                <div key={p._id} className="bento">
                  <button onClick={() => setOpenPlan(isOpen ? null : p._id)} className="flex w-full items-center justify-between text-left">
                    <div>
                      <p className="text-sm font-bold">{p.company}</p>
                      <p className="text-xs text-soft">
                        {dl === 0 ? "Interview today — you've got this!" : `${dl} day(s) left`} · {doneCount}/{total} tasks done
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
                      </div>
                      <span className="text-soft">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-3">
                      {p.plan.strategy && <p className="text-xs leading-relaxed text-soft">{p.plan.strategy}</p>}
                      {p.plan.days.map((d, di) => (
                        <div key={di} className={`rounded-xl border p-3.5 ${di === todayIdx ? "border-accent/50 bg-accent/5" : "border-line"}`}>
                          <p className="mb-2 text-xs font-bold">
                            Day {d.day} — {d.focus}
                            {di === todayIdx && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">today</span>}
                          </p>
                          <div className="space-y-1.5">
                            {d.tasks.map((t, ti) => {
                              const checked = !!p.done?.[`${di}-${ti}`];
                              return (
                                <label key={ti} className="flex cursor-pointer items-start gap-2.5 text-sm">
                                  <input type="checkbox" checked={checked} onChange={() => toggleTask(p._id, di, ti)}
                                         className="mt-0.5 accent-current" />
                                  <span className={checked ? "text-soft line-through" : ""}>
                                    {t.title}
                                    <span className={`ml-2 text-[10px] font-semibold uppercase ${KIND_COLOR[t.kind] ?? "text-soft"}`}>
                                      {t.kind} · {t.estMinutes}m
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
