// Resume upload — hero dropzone when no resume, compact chip once analyzed.
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore.js";

export default function UploadCard() {
  const inputRef = useRef(null);
  const storedResumeId = useAppStore((s) => s.resumeId);
  const setResume = useAppStore((s) => s.setResume);
  const setResumeData = useAppStore((s) => s.setResumeData);
  const resumeMeta = useAppStore((s) => s.resumeMeta);

  // idle | uploading | analyzing | done | error
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file) {
    if (!file) return;
    setPhase("uploading");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file); // must match upload.single("file") server-side
      const res = await fetch("/api/resume/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setResult(data);
      setPhase("analyzing"); // background pipeline running — poll below
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  }

  // Poll while the AI pipeline runs.
  useEffect(() => {
    if (phase !== "analyzing" || !result) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/resume/${result.resumeId}`);
        const data = await res.json();
        if (data.status === "ready") {
          setPhase("done");
          setResume(data.resumeId, true);
          setResumeData(data.parsed, { fileName: data.fileName, stats: data.stats });
        } else if (data.status === "failed") {
          setError(data.error || "Analysis failed");
          setPhase("error");
        }
      } catch { /* transient — retry next tick */ }
    }, 1500);
    return () => clearInterval(timer);
  }, [phase, result]);

  // Restore after refresh (resumeId persisted in localStorage).
  useEffect(() => {
    if (!storedResumeId || phase !== "idle" || result) return;
    (async () => {
      try {
        const res = await fetch(`/api/resume/${storedResumeId}`);
        const data = await res.json();
        if (data.ok && data.status === "ready") {
          setResult(data);
          setPhase("done");
          setResume(data.resumeId, true);
          setResumeData(data.parsed, { fileName: data.fileName, stats: data.stats });
        }
      } catch { /* server not up — user can re-upload */ }
    })();
  }, []);

  function reset() {
    setPhase("idle");
    setResult(null);
    setResume(null, false);
  }

  // ---- Compact mode: resume is analyzed ----
  if (phase === "done" && resumeMeta) {
    return (
      <div className="bento flex items-center justify-between gap-3 !py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{resumeMeta.fileName}</p>
          <p className="text-xs text-soft">
            {resumeMeta.stats.pages} page(s) · {resumeMeta.stats.words} words · analyzed ✓
          </p>
        </div>
        <button
          onClick={reset}
          className="shrink-0 rounded-xl border border-line px-3 py-1.5 text-xs text-soft transition-colors hover:text-strong"
        >
          Replace
        </button>
      </div>
    );
  }

  // ---- Hero mode: no resume yet ----
  return (
    <div className="mx-auto max-w-xl">
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFile(e.dataTransfer.files[0]); }}
        className={`bento bento-hover cursor-pointer border-2 border-dashed p-12 text-center ${
          dragOver ? "border-accent" : "!border-line hover:!border-accent"
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
          <p className="animate-pulse text-sm text-accent">Uploading & extracting text…</p>
        ) : phase === "analyzing" ? (
          <p className="animate-pulse text-sm text-accent">AI is analyzing your resume…</p>
        ) : (
          <>
            <p className="text-base font-semibold">Drop your resume PDF here</p>
            <p className="mt-1 text-xs text-soft">or click to browse · PDF only · max 5 MB</p>
          </>
        )}
        {phase === "error" && <p className="mt-3 text-xs text-red-400">{error} — try again.</p>}
      </div>
    </div>
  );
}
