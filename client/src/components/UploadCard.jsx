// Resume upload card — drag & drop or click to choose a PDF.
// Demonstrates the standard async-UI pattern: one `phase` state drives
// everything the user sees (idle → uploading → done | error).
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore.js";

export default function UploadCard() {
  const inputRef = useRef(null);
  const storedResumeId = useAppStore((s) => s.resumeId);
  const setResume = useAppStore((s) => s.setResume);
  // idle | uploading | analyzing | done | error
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null); // upload response (stats, preview)
  const [profile, setProfile] = useState(null); // AI-extracted parsed data
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file) {
    if (!file) return;
    setPhase("uploading");
    setError(null);
    setProfile(null);
    try {
      // FormData builds the multipart/form-data body multer expects.
      // Field name "file" must match upload.single("file") on the server.
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resume/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setResult(data);
      setPhase("analyzing"); // server pipeline is running — start polling
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  }

  // Poll GET /api/resume/:id every 1.5s while the AI pipeline runs.
  // (Simple version — Step 3 upgrades this to SSE where the server pushes progress.)
  useEffect(() => {
    if (phase !== "analyzing" || !result) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/resume/${result.resumeId}`);
        const data = await res.json();
        if (data.status === "ready") {
          setProfile(data.parsed);
          setPhase("done");
          setResume(data.resumeId, true); // unlock the metrics panel + persist
        } else if (data.status === "failed") {
          setError(data.error || "Analysis failed");
          setPhase("error");
        } // else: still parsing — keep polling
      } catch {
        /* transient network error — next tick will retry */
      }
    }, 1500);
    return () => clearInterval(timer); // cleanup: stop polling when phase changes
  }, [phase, result]);

  // Restore a previously uploaded resume after a page refresh (resumeId
  // persists in localStorage via the zustand store).
  useEffect(() => {
    if (!storedResumeId || phase !== "idle" || result) return;
    (async () => {
      try {
        const res = await fetch(`/api/resume/${storedResumeId}`);
        const data = await res.json();
        if (data.ok && data.status === "ready") {
          setResult(data);
          setProfile(data.parsed);
          setPhase("done");
          setResume(data.resumeId, true);
        }
      } catch {
        /* server not up yet — user can just re-upload */
      }
    })();
  }, []); // run once on mount

  return (
    <div className="max-w-xl rounded-xl border border-line bg-surface p-5">
      <h3 className="font-medium mb-3">Your resume</h3>

      {phase !== "done" && (
        <div
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFile(e.dataTransfer.files[0]); }}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-accent bg-ink" : "border-line hover:border-accent"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => uploadFile(e.target.files[0])}
          />
          {phase === "uploading" ? (
            <p className="text-accent text-sm animate-pulse">Uploading & extracting text…</p>
          ) : phase === "analyzing" ? (
            <p className="text-accent text-sm animate-pulse">
              AI is analyzing your resume (skills, projects, experience)…
            </p>
          ) : (
            <>
              <p className="text-sm">Drop your resume PDF here, or click to browse</p>
              <p className="text-xs text-soft mt-1">PDF only · max 5 MB</p>
            </>
          )}
        </div>
      )}

      {phase === "error" && (
        <p className="mt-3 text-sm text-red-400">{error} — try again.</p>
      )}

      {phase === "done" && result && profile && (
        <div className="text-sm space-y-4">
          <p>
            <span className="text-emerald-400">✓</span> {result.fileName} —{" "}
            {result.stats.pages} page(s), {result.stats.words} words · analyzed
          </p>

          <p className="text-soft text-xs leading-relaxed">{profile.summary}</p>

          <div>
            <p className="text-xs font-medium mb-2">
              Skills detected ({profile.skills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-line bg-ink px-2.5 py-0.5 text-xs text-accent"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ["Projects", profile.projects.length],
              ["Experience", profile.experience.length],
              ["Education", profile.education.length],
            ].map(([label, n]) => (
              <div key={label} className="rounded-lg border border-line bg-ink p-2">
                <p className="text-lg font-semibold">{n}</p>
                <p className="text-xs text-soft">{label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setPhase("idle"); setResult(null); setProfile(null); setResume(null, false); }}
            className="text-xs text-accent hover:underline"
          >
            Upload a different resume
          </button>
        </div>
      )}
    </div>
  );
}
