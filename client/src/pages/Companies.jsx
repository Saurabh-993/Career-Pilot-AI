// Companies — matches, company selector, filters (incl. experience + location),
// applied tracking ("x days ago" + Learn), tailor-resume, fastest-path roadmaps.
import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore.js";
import RoadmapFlow from "../components/RoadmapFlow.jsx";

const matchColor = (p) =>
  p == null ? "border-line text-soft" :
  p >= 70 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" :
  p >= 40 ? "border-amber-500/40 bg-amber-500/10 text-amber-500" :
  "border-red-400/40 bg-red-400/10 text-red-400";

const daysAgo = (date) => {
  const d = Math.floor((Date.now() - new Date(date)) / 86400000);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const appKey = (j) => `${j.company}::${j.role}`;

export default function Companies() {
  const resumeId = useAppStore((s) => s.resumeId);
  const resumeReady = useAppStore((s) => s.resumeReady);

  const [jobs, setJobs] = useState([]);
  const [applied, setApplied] = useState({}); // key → appliedAt
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  // Filters — all client-side, instant
  const [q, setQ] = useState("");
  const [locationQ, setLocationQ] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [expFilter, setExpFilter] = useState("fit"); // fit | all
  const [minMatch, setMinMatch] = useState(0);
  const [sort, setSort] = useState("match");
  // Company selector
  const [companyQ, setCompanyQ] = useState("");
  const [companyBusy, setCompanyBusy] = useState(false);
  // Manual fallbacks
  const [showManual, setShowManual] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualJd, setManualJd] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  // Modals
  const [roadmap, setRoadmap] = useState(null);
  const [tailor, setTailor] = useState(null); // { loading, job, data?, error? }

  async function loadMatches(refresh = false) {
    setLoading(true);
    setNotice(null);
    try {
      const [mRes, aRes] = await Promise.all([
        fetch(`/api/jobs/matches/${resumeId}${refresh ? "?refresh=1" : ""}`),
        fetch(`/api/jobs/applied/${resumeId}`),
      ]);
      const m = await mRes.json();
      const a = await aRes.json();
      if (!m.ok) throw new Error(m.error);
      setJobs(m.jobs);
      if (a.ok) setApplied(Object.fromEntries(a.applications.map((x) => [`${x.company}::${x.role}`, x.appliedAt])));
      if (!m.cached && m.failures > 0)
        setNotice(`${m.failures}/${m.sourcesTried} job sources didn't respond — showing the rest.`);
      if (!m.jobs.length) setNotice("No live matches right now — try a company above, or paste a link/JD.");
    } catch (e) {
      setNotice(`Couldn't load matches: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (resumeId && resumeReady) loadMatches(); }, [resumeId, resumeReady]);

  async function fetchCompany() {
    setCompanyBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/jobs/company", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, company: companyQ.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setJobs((prev) => [...data.jobs, ...prev]);
      setNotice(`Found ${data.jobs.length} openings at ${companyQ.trim()}.`);
      setCompanyQ("");
    } catch (e) { setNotice(e.message); }
    finally { setCompanyBusy(false); }
  }

  async function analyzeManual() {
    setManualBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/jobs/manual", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, url: manualUrl.trim() || undefined, jdText: manualJd.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setJobs((prev) => [...data.jobs, ...prev]);
      setManualUrl(""); setManualJd(""); setShowManual(false);
    } catch (e) { setNotice(e.message); }
    finally { setManualBusy(false); }
  }

  async function markApplied(job) {
    setApplied((p) => ({ ...p, [appKey(job)]: new Date().toISOString() }));
    fetch("/api/jobs/applied", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId, role: job.role, company: job.company, applyUrl: job.applyUrl }),
    }).catch(() => {});
  }

  async function openRoadmap(job) {
    setRoadmap({ loading: true, targetRole: job.role });
    try {
      const res = await fetch("/api/jobs/roadmap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, targetRole: job.role, missingSkills: job.missingSkills }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setRoadmap({ loading: false, targetRole: job.role, data: data.roadmap });
    } catch (e) { setRoadmap({ loading: false, targetRole: job.role, error: e.message }); }
  }

  async function openTailor(job) {
    setTailor({ loading: true, job });
    try {
      const res = await fetch("/api/jobs/tailor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, job }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setTailor({ loading: false, job, data: data.tailored });
    } catch (e) { setTailor({ loading: false, job, error: e.message }); }
  }

  function downloadTailored() {
    const blob = new Blob([tailor.data.tailoredResumeMd], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `resume-tailored-${tailor.job.company || "job"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const filtered = useMemo(() => {
    let list = jobs.filter((j) => {
      if (q && !`${j.role} ${j.company}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (locationQ && !`${j.location}`.toLowerCase().includes(locationQ.toLowerCase())) return false;
      if (remoteOnly && !j.remote) return false;
      if (expFilter === "fit" && j.expFit === "stretch") return false;
      if (minMatch > 0 && (j.matchPercent ?? -1) < minMatch) return false;
      return true;
    });
    if (sort === "latest") list = [...list].sort((a, b) => new Date(b.postedAt ?? 0) - new Date(a.postedAt ?? 0));
    else list = [...list].sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1));
    return list;
  }, [jobs, q, locationQ, remoteOnly, expFilter, minMatch, sort]);

  if (!resumeReady)
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-extrabold tracking-tight">Companies</h2>
        <p className="mt-2 text-sm text-soft">Upload your resume on Home first — matches are personalized to it.</p>
      </div>
    );

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight">Companies</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowManual((v) => !v)}
                  className="rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-soft hover:text-strong">
            + Add job (link / JD)
          </button>
          <button onClick={() => loadMatches(true)} disabled={loading}
                  className="rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
            ↻ Refresh matches
          </button>
        </div>
      </div>

      {/* Company selector — official Greenhouse/Lever public boards */}
      <div className="bento mb-4 flex flex-wrap items-center gap-3 !py-3.5">
        <input value={companyQ} onChange={(e) => setCompanyQ(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && companyQ.trim() && fetchCompany()}
               placeholder="Target a company (e.g. Stripe, Notion, Razorpay)…"
               className="w-72 rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent" />
        <button onClick={fetchCompany} disabled={companyBusy || !companyQ.trim()}
                className="rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {companyBusy ? "Searching…" : "Get company jobs"}
        </button>
        <p className="text-[11px] text-soft">
          Works for companies on Greenhouse/Lever. Locked portals (Microsoft, Google): paste the job link instead.
        </p>
      </div>

      {/* Manual fallback panel */}
      {showManual && (
        <div className="bento mb-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">
            Analyze a specific job — works even when job boards are down
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-soft">Job link</label>
              <input value={manualUrl} onChange={(e) => setManualUrl(e.target.value)}
                     placeholder="https://company.com/careers/role"
                     className="w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-soft">…or paste JD text (one or many)</label>
              <textarea value={manualJd} onChange={(e) => setManualJd(e.target.value)} rows={3}
                        placeholder="Paste one or multiple job descriptions…"
                        className="w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
          </div>
          <button onClick={analyzeManual} disabled={manualBusy || (!manualUrl.trim() && !manualJd.trim())}
                  className="mt-3 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {manualBusy ? "Analyzing…" : "Analyze & match"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bento mb-4 flex flex-wrap items-center gap-3 !py-3.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Role or company…"
               className="w-44 rounded-xl border border-line bg-ink px-3 py-1.5 text-sm outline-none focus:border-accent" />
        <input value={locationQ} onChange={(e) => setLocationQ(e.target.value)} placeholder="Location…"
               className="w-36 rounded-xl border border-line bg-ink px-3 py-1.5 text-sm outline-none focus:border-accent" />
        <label className="flex items-center gap-1.5 text-xs text-soft">
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} className="accent-current" />
          Remote
        </label>
        <select value={expFilter} onChange={(e) => setExpFilter(e.target.value)}
                className="rounded-xl border border-line bg-ink px-2.5 py-1.5 text-xs outline-none">
          <option value="fit">My level</option>
          <option value="all">All levels</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-soft">
          Min match <input type="range" min="0" max="90" step="10" value={minMatch}
                           onChange={(e) => setMinMatch(+e.target.value)} className="accent-current" />
          <span className="w-8 font-semibold">{minMatch}%</span>
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
                className="ml-auto rounded-xl border border-line bg-ink px-2.5 py-1.5 text-xs outline-none">
          <option value="match">Best match</option>
          <option value="latest">Latest first</option>
        </select>
        <span className="text-xs text-soft">{filtered.length} jobs</span>
      </div>

      {notice && <p className="mb-4 text-xs text-amber-500">{notice}</p>}
      {loading && <p className="animate-pulse text-sm text-accent">Searching job sources & matching against your resume…</p>}

      {/* Job cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((j, i) => {
          const appliedAt = applied[appKey(j)];
          return (
            <div key={i} className="bento bento-hover flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{j.role}</p>
                  <p className="truncate text-xs text-soft">
                    {j.company}{j.location ? ` · ${j.location}` : ""}{j.remote ? " · remote" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${matchColor(j.matchPercent)}`}>
                    {j.matchPercent == null ? "—" : `${j.matchPercent}%`}
                  </span>
                  {j.expFit === "stretch" && (
                    <span className="text-[9px] font-semibold uppercase text-red-400">senior role</span>
                  )}
                </div>
              </div>

              {j.missingSkills?.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-500">Missing skills</p>
                  <div className="flex flex-wrap gap-1">
                    {j.missingSkills.slice(0, 6).map((s) => (
                      <span key={s} className="rounded-full border border-line px-2 py-0.5 text-[10px] text-soft">{s}</span>
                    ))}
                    {j.missingSkills.length > 6 && <span className="text-[10px] text-soft">+{j.missingSkills.length - 6}</span>}
                  </div>
                </div>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                {appliedAt ? (
                  <>
                    <span className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-500">
                      ✓ Applied {daysAgo(appliedAt)}
                    </span>
                    <button onClick={() => openRoadmap(j)}
                            className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                      Learn → prepare
                    </button>
                  </>
                ) : (
                  <>
                    {j.applyUrl && (
                      <a href={j.applyUrl} target="_blank" rel="noreferrer" onClick={() => markApplied(j)}
                         className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                        Apply ↗
                      </a>
                    )}
                    <button onClick={() => openTailor(j)}
                            className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-soft hover:text-strong">
                      Tailor resume
                    </button>
                    <button onClick={() => openRoadmap(j)}
                            className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-soft hover:text-strong">
                      Fastest path
                    </button>
                  </>
                )}
                <span className="ml-auto text-[10px] text-soft">{j.source}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Roadmap modal — large, wheel pans, Ctrl+wheel zooms */}
      {roadmap && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setRoadmap(null)}>
          <div className="bento flex h-[85vh] w-full max-w-5xl flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Fastest path → {roadmap.targetRole}</h3>
                {roadmap.data?.summary && (
                  <p className="mt-0.5 text-xs text-soft">{roadmap.data.summary} · ~{roadmap.data.totalEstHours}h total</p>
                )}
              </div>
              <button onClick={() => setRoadmap(null)} className="grid h-8 w-8 place-items-center rounded-full border border-line text-soft hover:text-strong">✕</button>
            </div>
            {roadmap.loading && <p className="animate-pulse py-16 text-center text-sm text-accent">Designing your fastest path…</p>}
            {roadmap.error && <p className="py-10 text-center text-sm text-red-400">{roadmap.error}</p>}
            {roadmap.data && <div className="min-h-0 flex-1"><RoadmapFlow roadmap={roadmap.data} /></div>}
          </div>
        </div>
      )}

      {/* Tailor resume modal */}
      {tailor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setTailor(null)}>
          <div className="bento max-h-[85vh] w-full max-w-3xl overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">
                Tailored for {tailor.job.role}{tailor.job.company ? ` @ ${tailor.job.company}` : ""}
              </h3>
              <button onClick={() => setTailor(null)} className="grid h-8 w-8 place-items-center rounded-full border border-line text-soft hover:text-strong">✕</button>
            </div>
            {tailor.loading && <p className="animate-pulse py-16 text-center text-sm text-accent">Tailoring your resume for this job…</p>}
            {tailor.error && <p className="py-10 text-center text-sm text-red-400">{tailor.error}</p>}
            {tailor.data && (
              <div className="space-y-4">
                <div className="rounded-xl border border-line p-4">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-accent">New summary</p>
                  <p className="text-sm leading-relaxed">{tailor.data.tailoredSummary}</p>
                </div>
                <div className="rounded-xl border border-line p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-accent">ATS keywords to include</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailor.data.keywordsToAdd.map((k) => (
                      <span key={k} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">{k}</span>
                    ))}
                  </div>
                </div>
                {tailor.data.bulletImprovements.length > 0 && (
                  <div className="rounded-xl border border-line p-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-accent">Bullet upgrades</p>
                    <div className="space-y-3">
                      {tailor.data.bulletImprovements.map((b, i) => (
                        <div key={i} className="text-xs leading-relaxed">
                          <p className="text-soft line-through">{b.original}</p>
                          <p className="mt-0.5 font-medium text-emerald-500">→ {b.improved}</p>
                          {b.why && <p className="mt-0.5 text-[11px] text-soft">{b.why}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={downloadTailored}
                          className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
                    ⬇ Download tailored resume (.md)
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(tailor.data.tailoredResumeMd)}
                          className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-soft hover:text-strong">
                    Copy markdown
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
