// Job routes: cached matches, manual fallbacks (URL / pasted JD), roadmaps.
import { Router } from "express";
import { JobMatch } from "../models/JobMatch.js";
import { Roadmap } from "../models/Roadmap.js";
import { Resume } from "../models/Resume.js";
import { Application } from "../models/Application.js";
import { matchJobs, scoreJob, candidateLevel, fillMissingSkills } from "../pipelines/matchJobs.js";
import { generateRoadmap } from "../pipelines/generateRoadmap.js";
import { scrapeJobPage, fetchCompanyBoards } from "../services/jobSources.js";
import { getProvider } from "../ai/provider.js";
import { JobsFromTextSchema, TailorSchema } from "shared";

export const jobsRouter = Router();

// GET /api/jobs/matches/:resumeId  (?refresh=1 bypasses the 48h cache)
jobsRouter.get("/matches/:resumeId", async (req, res, next) => {
  try {
    const cached = await JobMatch.findOne({ resumeId: req.params.resumeId });
    if (cached && !req.query.refresh)
      return res.json({ ok: true, jobs: cached.jobs, cached: true, generatedAt: cached.updatedAt });

    const { doc, failures, sourcesTried } = await matchJobs(req.params.resumeId);
    res.json({ ok: true, jobs: doc.jobs, cached: false, failures, sourcesTried });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/manual  { resumeId, url? | jdText? }
// Fallback path: analyze a specific job link, or pasted JD text (may contain
// SEVERAL jobs at once) — works even if every job API is down.
jobsRouter.post("/manual", async (req, res, next) => {
  try {
    const { resumeId, url, jdText } = req.body;
    const resume = await Resume.findById(resumeId);
    if (!resume?.parsed) throw Object.assign(new Error("Resume not analyzed yet"), { status: 409 });

    let text, sourceLabel, applyUrl = "";
    if (url) {
      const page = await scrapeJobPage(url);
      text = `${page.title}\n${page.text}`;
      sourceLabel = "link";
      applyUrl = url;
    } else if (jdText?.trim()) {
      text = jdText.trim().slice(0, 15000);
      sourceLabel = "pasted";
    } else {
      throw Object.assign(new Error("Provide a job url or jdText"), { status: 400 });
    }

    const { jobs } = await getProvider().json(
      `Extract every distinct job posting from this text (there may be one or several). Return JSON {"jobs":[...]} where each job = {"role","company","location","remote","seniority","salary","skills":[individual technical skills],"applyUrl","source","postedAt"}. Use "" or null for unknown fields, source="${sourceLabel}".

TEXT:
${text}`,
      JobsFromTextSchema
    );

    const scored = jobs.map((j) =>
      scoreJob(
        { ...j, applyUrl: j.applyUrl || applyUrl, source: sourceLabel },
        resume.parsed.skills,
        candidateLevel(resume.parsed)
      )
    );

    // Prepend to the cache so they appear with the rest (and survive reloads).
    await JobMatch.findOneAndUpdate(
      { resumeId },
      {
        $setOnInsert: { resumeId, queries: [], expiresAt: new Date(Date.now() + 48 * 3600 * 1000) },
        $push: { jobs: { $each: scored, $position: 0 } },
      },
      { upsert: true }
    );
    res.json({ ok: true, jobs: scored });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/company  { resumeId, company } — fetch a specific company's
// openings via Greenhouse/Lever public boards, matched against the resume.
jobsRouter.post("/company", async (req, res, next) => {
  try {
    const { resumeId, company } = req.body;
    if (!company?.trim()) throw Object.assign(new Error("company required"), { status: 400 });
    const resume = await Resume.findById(resumeId);
    if (!resume?.parsed) throw Object.assign(new Error("Resume not analyzed yet"), { status: 409 });

    let jobs = await fetchCompanyBoards(company.trim());
    // These boards rarely list skill tags — AI-extract from descriptions (batched).
    jobs = await fillMissingSkills(jobs);
    const level = candidateLevel(resume.parsed);
    const scored = jobs
      .map((j) => scoreJob(j, resume.parsed.skills, level))
      .map(({ _description, ...j }) => j)
      .sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1));
    res.json({ ok: true, jobs: scored });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/applied  { resumeId, role, company, applyUrl } — mark applied.
jobsRouter.post("/applied", async (req, res, next) => {
  try {
    const { resumeId, role, company, applyUrl } = req.body;
    const doc = await Application.findOneAndUpdate(
      { resumeId, company: company ?? "", role },
      { $setOnInsert: { resumeId, role, company: company ?? "", applyUrl: applyUrl ?? "", appliedAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, application: doc });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/applied/:resumeId — all applications (for badges + tracking).
jobsRouter.get("/applied/:resumeId", async (req, res, next) => {
  try {
    const apps = await Application.find({ resumeId: req.params.resumeId }).sort({ appliedAt: -1 });
    res.json({ ok: true, applications: apps });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/tailor  { resumeId, job } — tailor the resume for one job.
jobsRouter.post("/tailor", async (req, res, next) => {
  try {
    const { resumeId, job } = req.body;
    const resume = await Resume.findById(resumeId);
    if (!resume?.parsed) throw Object.assign(new Error("Resume not analyzed yet"), { status: 409 });

    const tailored = await getProvider().json(
      `You are an expert resume writer. Tailor this candidate's resume for the specific job below. NEVER invent experience — only reframe, reorder, and re-word what they actually have.

Return JSON:
- "tailoredSummary": rewritten professional summary targeting this job
- "keywordsToAdd": ATS keywords from the JD the resume should naturally include
- "bulletImprovements": [{"original","improved","why"}] — 3-6 of their actual bullets rewritten to speak to this job (quantify where their data allows)
- "tailoredResumeMd": the FULL tailored resume as clean markdown (name, summary, skills ordered by relevance to this job, experience with improved bullets, projects most relevant first, education)

JOB: ${JSON.stringify({ role: job.role, company: job.company, skills: job.skills, seniority: job.seniority })}

CANDIDATE RESUME (parsed): ${JSON.stringify(resume.parsed)}`,
      TailorSchema
    );
    res.json({ ok: true, tailored });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/roadmap  { resumeId, targetRole, missingSkills? , refresh? }
jobsRouter.post("/roadmap", async (req, res, next) => {
  try {
    const { resumeId, targetRole, missingSkills, refresh } = req.body;
    if (!targetRole) throw Object.assign(new Error("targetRole required"), { status: 400 });

    const cached = await Roadmap.findOne({ resumeId, targetRole });
    if (cached && !refresh) return res.json({ ok: true, roadmap: cached.roadmap, cached: true });

    const doc = await generateRoadmap(resumeId, targetRole, missingSkills ?? []);
    res.json({ ok: true, roadmap: doc.roadmap, cached: false });
  } catch (err) {
    next(err);
  }
});
