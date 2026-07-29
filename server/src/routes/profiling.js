// Profiling routes — MCQ quiz with SERVER-SIDE grading.
// Security principle: the correct answers never leave the server before the
// user has answered. If we shipped answerIdx to the browser, anyone could
// read it in DevTools → the "verified level" would be meaningless.

import { Router } from "express";
import { Quiz } from "../models/Quiz.js";
import { Profile } from "../models/Profile.js";
import { generateQuiz } from "../pipelines/generateQuiz.js";

export const profilingRouter = Router();

// Strip answers/explanations before sending questions to the client.
const publicQuestion = ({ q, options, topic, difficulty }) => ({ q, options, topic, difficulty });

// POST /api/profiling/start  { resumeId }
profilingRouter.post("/start", async (req, res, next) => {
  try {
    const { quiz, attempt, attemptsLeft } = await generateQuiz(req.body.resumeId);
    res.json({
      ok: true,
      quizId: quiz._id,
      attempt,
      attemptsLeft,
      questions: quiz.questions.map(publicQuestion),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/profiling/answer  { quizId, qIdx, answerIdx }
profilingRouter.post("/answer", async (req, res, next) => {
  try {
    const { quizId, qIdx, answerIdx } = req.body;
    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.status !== "active")
      throw Object.assign(new Error("Quiz not found or already finished"), { status: 404 });
    const question = quiz.questions[qIdx];
    if (!question) throw Object.assign(new Error("Invalid question index"), { status: 400 });
    if (quiz.responses.some((r) => r.qIdx === qIdx))
      throw Object.assign(new Error("Question already answered"), { status: 409 });

    const correct = answerIdx === question.answerIdx;
    quiz.responses.push({ qIdx, answerIdx, correct });
    await quiz.save();

    // NOW it's safe to reveal the answer + explanation:
    res.json({ ok: true, correct, correctIdx: question.answerIdx, explanation: question.explanation });
  } catch (err) {
    next(err);
  }
});

// POST /api/profiling/finish  { quizId } → score + per-topic breakdown → saved to Profile
profilingRouter.post("/finish", async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.body.quizId);
    if (!quiz) throw Object.assign(new Error("Quiz not found"), { status: 404 });

    const byTopic = {};
    const byDifficulty = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 },
    };
    for (const [i, question] of quiz.questions.entries()) {
      const r = quiz.responses.find((x) => x.qIdx === i);
      const t = (byTopic[question.topic] ??= { correct: 0, total: 0 });
      t.total++;
      const d = byDifficulty[question.difficulty] ?? (byDifficulty[question.difficulty] = { correct: 0, total: 0 });
      d.total++;
      if (r?.correct) { t.correct++; d.correct++; }
    }
    const score = Math.round(
      (quiz.responses.filter((r) => r.correct).length / quiz.questions.length) * 100
    );

    // Level verdict — WEIGHTED by difficulty (hard answers prove more than
    // easy ones): easy=1, medium=2, hard=3 points.
    const weights = { easy: 1, medium: 2, hard: 3 };
    let earned = 0, possible = 0;
    for (const [diff, d] of Object.entries(byDifficulty)) {
      earned += d.correct * (weights[diff] ?? 1);
      possible += d.total * (weights[diff] ?? 1);
    }
    const weightedPct = possible ? (earned / possible) * 100 : 0;
    const level =
      weightedPct >= 85 ? "Expert" :
      weightedPct >= 65 ? "Advanced" :
      weightedPct >= 40 ? "Intermediate" : "Beginner";

    quiz.status = "finished";
    quiz.score = score;
    quiz.byTopic = byTopic;
    await quiz.save();

    // Attach the verified level to the career profile (if it exists yet).
    await Profile.findOneAndUpdate(
      { resumeId: quiz.resumeId },
      { $set: { verifiedLevel: { score, level, byTopic, byDifficulty, quizId: quiz._id } } }
    );

    res.json({ ok: true, score, level, byTopic, byDifficulty });
  } catch (err) {
    next(err);
  }
});
