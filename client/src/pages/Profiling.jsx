// Profiling quiz runner — one question per screen, instant feedback with
// explanation after each answer, per-topic results at the end.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore.js";

export default function Profiling() {
  const navigate = useNavigate();
  const resumeId = useAppStore((s) => s.resumeId);
  const setProfiling = useAppStore((s) => s.setProfiling);

  const [phase, setPhase] = useState("loading"); // loading | quiz | results | error
  const [error, setError] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [attemptInfo, setAttemptInfo] = useState(null); // { attempt, attemptsLeft }
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // { correct, correctIdx, explanation }
  const [results, setResults] = useState(null);

  // Generate the quiz on mount.
  useEffect(() => {
    if (!resumeId) return navigate("/");
    (async () => {
      try {
        const res = await fetch("/api/profiling/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setQuizId(data.quizId);
        setAttemptInfo({ attempt: data.attempt, attemptsLeft: data.attemptsLeft });
        setQuestions(data.questions);
        setPhase("quiz");
      } catch (e) {
        setError(e.message);
        setPhase("error");
      }
    })();
  }, []);

  async function submitAnswer(answerIdx) {
    if (feedback) return; // already answered this one
    setSelected(answerIdx);
    try {
      const res = await fetch("/api/profiling/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, qIdx: idx, answerIdx }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setFeedback(data);
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  }

  async function next() {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setSelected(null);
      setFeedback(null);
      return;
    }
    // Last question → finish and grade.
    const res = await fetch("/api/profiling/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    const data = await res.json();
    setResults(data);
    setProfiling({ score: data.score, level: data.level, byTopic: data.byTopic, byDifficulty: data.byDifficulty });
    setPhase("results");
  }

  // Shared difficulty colors — badge in the quiz, bars in the results.
  const diffColor = {
    easy: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
    medium: "text-amber-400 border-amber-400/40 bg-amber-400/10",
    hard: "text-red-400 border-red-400/40 bg-red-400/10",
  };
  const diffBar = { easy: "bg-emerald-400", medium: "bg-amber-400", hard: "bg-red-400" };

  if (phase === "loading")
    return <p className="text-sm text-accent animate-pulse">Generating questions from your resume…</p>;

  if (phase === "error")
    return (
      <div>
        <p className="text-sm text-red-400 mb-3">{error}</p>
        <button onClick={() => navigate("/")} className="text-xs text-accent hover:underline">← Back to dashboard</button>
      </div>
    );

  if (phase === "results" && results)
    return (
      <div className="max-w-xl">
        <h2 className="text-2xl font-semibold mb-1">Your verified level</h2>
        <div className="flex items-end gap-4 my-6">
          <p className="text-5xl font-bold">{results.score}<span className="text-xl text-soft">/100</span></p>
          <span className="mb-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            {results.level}
          </span>
        </div>

        {/* Level chart — performance per difficulty tier. The verdict is
            weighted (hard proves more than easy), so this explains WHY. */}
        <div className="rounded-xl border border-line bg-surface p-5 mb-4">
          <p className="text-sm font-medium mb-1">Where you stand</p>
          <p className="text-xs text-soft mb-4">
            Level ladder: Beginner → Intermediate → Advanced → Expert. Hard questions weigh 3× easy ones.
          </p>
          <div className="space-y-3">
            {["easy", "medium", "hard"].map((d) => {
              const t = results.byDifficulty?.[d] ?? { correct: 0, total: 0 };
              const pct = t.total ? (t.correct / t.total) * 100 : 0;
              return (
                <div key={d}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize">{d}</span>
                    <span className="text-soft">{t.correct}/{t.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-line overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${diffBar[d]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 mb-6">
          <p className="text-sm font-medium mb-3">By topic</p>
          {Object.entries(results.byTopic).map(([topic, t]) => (
            <div key={topic} className="flex justify-between text-sm py-1.5 border-b border-line last:border-0">
              <span>{topic}</span>
              <span className={t.correct === t.total ? "text-emerald-400" : t.correct === 0 ? "text-red-400" : "text-amber-400"}>
                {t.correct}/{t.total}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
          >
            Back to dashboard
          </button>
          {attemptInfo && (
            <p className="text-xs text-soft">
              {attemptInfo.attemptsLeft > 0
                ? `${attemptInfo.attemptsLeft} attempt(s) left — fresh questions each time.`
                : "No attempts left for this resume — go build, then upload the improved version!"}
            </p>
          )}
        </div>
      </div>
    );

  const q = questions[idx];
  if (!q) return null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          Verify your level
          {attemptInfo && <span className="ml-2 text-xs font-normal text-soft">attempt {attemptInfo.attempt}/3</span>}
        </h2>
        <span className="flex items-center gap-2 text-xs text-soft">
          {idx + 1} / {questions.length} · {q.topic}
          <span className={`rounded-full border px-2 py-0.5 capitalize ${diffColor[q.difficulty] ?? ""}`}>
            {q.difficulty}
          </span>
        </span>
      </div>

      {/* progress bar */}
      <div className="h-1 rounded-full bg-line mb-6 overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${((idx + (feedback ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 mb-4">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{q.q}</pre>
      </div>

      <div className="space-y-2 mb-4">
        {q.options.map((opt, i) => {
          let style = "border-line hover:border-accent";
          if (feedback) {
            if (i === feedback.correctIdx) style = "border-emerald-400 bg-emerald-400/10";
            else if (i === selected) style = "border-red-400 bg-red-400/10";
            else style = "border-line opacity-60";
          } else if (i === selected) style = "border-accent";
          return (
            <button
              key={i}
              onClick={() => submitAnswer(i)}
              disabled={!!feedback}
              className={`w-full rounded-lg border bg-surface p-3 text-left text-sm transition-colors ${style}`}
            >
              <span className="text-soft mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className="rounded-xl border border-line bg-surface p-4 mb-4">
          <p className={`text-sm font-medium mb-1 ${feedback.correct ? "text-emerald-400" : "text-red-400"}`}>
            {feedback.correct ? "✓ Correct" : "✗ Not quite"}
          </p>
          <p className="text-xs text-soft leading-relaxed">{feedback.explanation}</p>
        </div>
      )}

      {feedback && (
        <button
          onClick={next}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
        >
          {idx + 1 < questions.length ? "Next question →" : "See my results"}
        </button>
      )}
    </div>
  );
}
