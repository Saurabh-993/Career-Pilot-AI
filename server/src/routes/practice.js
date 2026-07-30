// Practice routes — same server-authoritative grading as profiling:
// answers/explanations never reach the client before the user answers.
import { Router } from "express";
import { PracticeSet } from "../models/PracticeSet.js";
import { PrepPlan } from "../models/PrepPlan.js";
import { generatePractice } from "../pipelines/generatePractice.js";
import { generatePrepPlan } from "../pipelines/generatePrepPlan.js";

export const practiceRouter = Router();

const publicQuestion = ({ q, options, topic, difficulty }) => ({ q, options, topic, difficulty });

// POST /api/practice/generate  { resumeId, mode, company? }
practiceRouter.post("/generate", async (req, res, next) => {
  try {
    const { resumeId, mode, company } = req.body;
    if (!["standard", "company", "resume"].includes(mode))
      throw Object.assign(new Error("mode must be standard | company | resume"), { status: 400 });
    if (mode === "company" && !company?.trim())
      throw Object.assign(new Error("company required for company mode"), { status: 400 });

    const set = await generatePractice(resumeId, mode, company?.trim() ?? "");
    res.json({ ok: true, setId: set._id, questions: set.questions.map(publicQuestion) });
  } catch (err) {
    next(err);
  }
});

// POST /api/practice/attempt  { setId, qIdx, answerIdx }
practiceRouter.post("/attempt", async (req, res, next) => {
  try {
    const { setId, qIdx, answerIdx } = req.body;
    const set = await PracticeSet.findById(setId);
    if (!set || set.status !== "active")
      throw Object.assign(new Error("Set not found or finished"), { status: 404 });
    const question = set.questions[qIdx];
    if (!question) throw Object.assign(new Error("Invalid question index"), { status: 400 });
    if (set.responses.some((r) => r.qIdx === qIdx))
      throw Object.assign(new Error("Already answered"), { status: 409 });

    const correct = answerIdx === question.answerIdx;
    set.responses.push({ qIdx, answerIdx, correct });
    await set.save();
    res.json({ ok: true, correct, correctIdx: question.answerIdx, explanation: question.explanation });
  } catch (err) {
    next(err);
  }
});

// POST /api/practice/finish  { setId }
practiceRouter.post("/finish", async (req, res, next) => {
  try {
    const set = await PracticeSet.findById(req.body.setId);
    if (!set) throw Object.assign(new Error("Set not found"), { status: 404 });

    const byTopic = {};
    for (const [i, question] of set.questions.entries()) {
      const r = set.responses.find((x) => x.qIdx === i);
      const t = (byTopic[question.topic] ??= { correct: 0, total: 0 });
      t.total++;
      if (r?.correct) t.correct++;
    }
    set.score = Math.round((set.responses.filter((r) => r.correct).length / set.questions.length) * 100);
    set.byTopic = byTopic;
    set.status = "finished";
    await set.save();
    res.json({ ok: true, score: set.score, byTopic });
  } catch (err) {
    next(err);
  }
});

// GET /api/practice/history/:resumeId — past sets + aggregate topic accuracy
practiceRouter.get("/history/:resumeId", async (req, res, next) => {
  try {
    const sets = await PracticeSet.find({ resumeId: req.params.resumeId, status: "finished" })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("mode company score byTopic createdAt");
    const agg = {};
    for (const s of sets)
      for (const [topic, t] of Object.entries(s.byTopic ?? {})) {
        const a = (agg[topic] ??= { correct: 0, total: 0 });
        a.correct += t.correct;
        a.total += t.total;
      }
    res.json({ ok: true, sets, topicAccuracy: agg });
  } catch (err) {
    next(err);
  }
});

// ---- Prep plans ----

// POST /api/practice/prep-plan  { resumeId, company, interviewDate }
practiceRouter.post("/prep-plan", async (req, res, next) => {
  try {
    const { resumeId, company, interviewDate } = req.body;
    if (!company?.trim() || !interviewDate)
      throw Object.assign(new Error("company and interviewDate required"), { status: 400 });
    const doc = await generatePrepPlan(resumeId, company.trim(), interviewDate);
    res.json({ ok: true, plan: doc });
  } catch (err) {
    next(err);
  }
});

// GET /api/practice/prep-plans/:resumeId
practiceRouter.get("/prep-plans/:resumeId", async (req, res, next) => {
  try {
    const plans = await PrepPlan.find({ resumeId: req.params.resumeId }).sort({ interviewDate: 1 });
    res.json({ ok: true, plans });
  } catch (err) {
    next(err);
  }
});

// POST /api/practice/prep-plan/toggle  { planId, day, task } — check/uncheck a task
practiceRouter.post("/prep-plan/toggle", async (req, res, next) => {
  try {
    const { planId, day, task } = req.body;
    const plan = await PrepPlan.findById(planId);
    if (!plan) throw Object.assign(new Error("Plan not found"), { status: 404 });
    const key = `${day}-${task}`;
    plan.done = { ...plan.done, [key]: !plan.done?.[key] };
    plan.markModified("done"); // mongoose can't detect nested Object mutations
    await plan.save();
    res.json({ ok: true, done: plan.done });
  } catch (err) {
    next(err);
  }
});
