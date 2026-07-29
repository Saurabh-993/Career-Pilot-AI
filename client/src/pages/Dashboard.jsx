// Home — personalized greeting + bento grid of everything about the candidate.
import { useState } from "react";
import { Link } from "react-router-dom";
import UploadCard from "../components/UploadCard.jsx";
import MetricsPanel from "../components/MetricsPanel.jsx";
import DetailModal from "../components/DetailModal.jsx";
import { useAppStore } from "../store/useAppStore.js";

export default function Dashboard() {
  const resumeReady = useAppStore((s) => s.resumeReady);
  const parsed = useAppStore((s) => s.resumeParsed);
  const meta = useAppStore((s) => s.resumeMeta);
  const profiling = useAppStore((s) => s.profiling);
  const profilingSkipped = useAppStore((s) => s.profilingSkipped);
  const skipProfiling = useAppStore((s) => s.skipProfiling);
  const [modal, setModal] = useState(null); // "projects" | "experience" | "education"

  // Greeting name: AI-extracted (best) → smart filename guess (skips words
  // like "resume", "cv", "ai", "final") → nothing.
  const STOP = new Set(["resume", "cv", "ai", "final", "new", "copy", "updated", "draft", "latest", "my", "the"]);
  const fileGuess = meta?.fileName
    ?.replace(/\.pdf$/i, "")
    .split(/[_\-.\s]+/)
    .find((w) => w && !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w));
  const displayName =
    parsed?.name?.trim() ||
    (fileGuess ? fileGuess[0].toUpperCase() + fileGuess.slice(1) : "");

  // ---- No resume yet: centered hero ----
  if (!resumeReady) {
    return (
      <div className="flex min-h-[70vh] flex-col justify-center">
        <h2 className="mb-2 text-center text-3xl font-extrabold tracking-tight md:text-4xl">
          Welcome to Career<span className="text-accent">Pilot</span>
        </h2>
        <p className="mb-8 text-center text-sm text-soft">
          Upload your resume and get your personal career analysis in seconds.
        </p>
        <UploadCard />
      </div>
    );
  }

  // Modal data builders (from the AI-parsed resume)
  const modalData = {
    projects: {
      title: `Projects (${parsed?.projects?.length ?? 0})`,
      items: (parsed?.projects ?? []).map((p) => ({
        title: p.name, body: p.description, chips: p.technologies,
      })),
    },
    experience: {
      title: `Experience (${parsed?.experience?.length ?? 0})`,
      items: (parsed?.experience ?? []).map((e) => ({
        title: e.role, subtitle: [e.company, e.duration].filter(Boolean).join(" · "),
        body: e.highlights?.join(" • "),
      })),
    },
    education: {
      title: `Education (${parsed?.education?.length ?? 0})`,
      items: (parsed?.education ?? []).map((e) => ({
        title: e.degree, subtitle: [e.institution, e.year].filter(Boolean).join(" · "),
      })),
    },
  };

  const tiles = [
    ["projects", "Projects", parsed?.projects?.length ?? 0],
    ["experience", "Experience", parsed?.experience?.length ?? 0],
    ["education", "Education", parsed?.education?.length ?? 0],
  ];

  return (
    <div className="mt-4">
      {/* ---- Bento grid (identity cards first, then AI metrics) ---- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
        {/* Your resume — greeting, summary, clickable stat tiles */}
        <div className="bento order-1 md:col-span-3 xl:col-span-7">
          <p className="text-xs font-bold uppercase tracking-wider text-soft">Your resume</p>
          {displayName && (
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Hello, {displayName} 👋</h2>
          )}
          {parsed?.summary && (
            <p className="mt-2 mb-5 max-w-prose text-sm leading-relaxed text-soft">{parsed.summary}</p>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            {tiles.map(([key, label, n]) => (
              <button
                key={key}
                onClick={() => setModal(key)}
                className="bento-hover rounded-xl border border-line p-3.5 text-center transition-colors hover:border-accent"
              >
                <p className="text-2xl font-extrabold">{n}</p>
                <p className="mt-0.5 text-xs font-medium text-soft">{label}</p>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <UploadCard />
          </div>
        </div>

        {/* Skills — the chips are back */}
        <div className="bento order-3 md:col-span-3 xl:col-span-7">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">
            Skills detected {parsed?.skills?.length ? `(${parsed.skills.length})` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {(parsed?.skills ?? []).map((s) => (
              <span key={s} className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                {s}
              </span>
            ))}
            {!parsed?.skills?.length && <p className="text-sm text-soft">No skills extracted yet.</p>}
          </div>
        </div>

        {/* Profiling — verify level / show verified level */}
        <div className="bento order-4 md:col-span-3 xl:col-span-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Skill verification</p>
          {profiling ? (
            <div>
              <div className="flex items-end gap-3">
                <p className="text-4xl font-extrabold tracking-tight">{profiling.score}</p>
                <span className="mb-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  {profiling.level}
                </span>
              </div>
              <p className="mt-1 text-xs text-soft">verified through a resume-based quiz</p>
              <Link to="/profiling" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
                Retake (fresh questions) →
              </Link>
            </div>
          ) : profilingSkipped ? (
            <div>
              <p className="text-sm text-soft">Skipped — you know your level.</p>
              <Link to="/profiling" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
                Changed your mind? Verify now →
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold">Verify your level</p>
              <p className="mt-1 text-xs leading-relaxed text-soft">
                15 questions across easy, medium and hard — generated from your resume. Max 3 attempts.
              </p>
              <div className="mt-3 flex gap-2">
                <Link to="/profiling" className="rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90">
                  Start profiling
                </Link>
                <button onClick={skipProfiling} className="rounded-xl border border-line px-3.5 py-2 text-xs text-soft hover:text-strong">
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI metrics (ATS, strengths, gaps, tips, chart, role fit) */}
        <MetricsPanel />
      </div>

      {modal && <DetailModal {...modalData[modal]} onClose={() => setModal(null)} />}
    </div>
  );
}
