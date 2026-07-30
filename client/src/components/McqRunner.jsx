// Reusable MCQ runner — one question per screen, difficulty badge, instant
// feedback + explanation. Used by Practice (grading via the callbacks).
import { useState } from "react";

const diffColor = {
  easy: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  medium: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  hard: "text-red-400 border-red-400/40 bg-red-400/10",
};

export default function McqRunner({ questions, onAnswer, onFinish, title = "Practice" }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  const q = questions[idx];
  if (!q) return null;

  async function submit(answerIdx) {
    if (feedback) return;
    setSelected(answerIdx);
    try {
      setFeedback(await onAnswer(idx, answerIdx)); // { correct, correctIdx, explanation }
    } catch (e) {
      setError(e.message);
    }
  }

  function next() {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setSelected(null);
      setFeedback(null);
    } else {
      onFinish();
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold">{title}</h3>
        <span className="flex items-center gap-2 text-xs text-soft">
          {idx + 1} / {questions.length} · {q.topic}
          <span className={`rounded-full border px-2 py-0.5 capitalize ${diffColor[q.difficulty] ?? ""}`}>
            {q.difficulty}
          </span>
        </span>
      </div>

      <div className="mb-6 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent transition-all"
             style={{ width: `${((idx + (feedback ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="bento mb-4">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{q.q}</pre>
      </div>

      <div className="mb-4 space-y-2">
        {q.options.map((opt, i) => {
          let style = "border-line hover:border-accent";
          if (feedback) {
            if (i === feedback.correctIdx) style = "border-emerald-400 bg-emerald-400/10";
            else if (i === selected) style = "border-red-400 bg-red-400/10";
            else style = "border-line opacity-60";
          } else if (i === selected) style = "border-accent";
          return (
            <button key={i} onClick={() => submit(i)} disabled={!!feedback}
                    className={`w-full rounded-xl border bg-surface p-3 text-left text-sm transition-colors ${style}`}>
              <span className="mr-2 text-soft">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {feedback && (
        <div className="bento mb-4 !py-4">
          <p className={`mb-1 text-sm font-semibold ${feedback.correct ? "text-emerald-400" : "text-red-400"}`}>
            {feedback.correct ? "✓ Correct" : "✗ Not quite"}
          </p>
          <p className="text-xs leading-relaxed text-soft">{feedback.explanation}</p>
        </div>
      )}

      {feedback && (
        <button onClick={next}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          {idx + 1 < questions.length ? "Next question →" : "See results"}
        </button>
      )}
    </div>
  );
}
