// Job matching pipeline:
//   derive queries → fetch sources (parallel, fail-soft) → AI-fill missing
//   skills → score by SKILL OVERLAP (local, free, deterministic) → cache 48h.
//
// Deliberate design lesson: matching is set intersection, NOT an AI call.
// Use AI where language understanding is needed (extracting skills from
// prose); use plain code where logic is exact. Cheaper, faster, testable.

import { Resume } from "../models/Resume.js";
import { Profile } from "../models/Profile.js";
import { JobMatch } from "../models/JobMatch.js";
import { getProvider } from "../ai/provider.js";
import { fetchRemotive, fetchArbeitnow, fetchRemoteOK, fetchJobicy } from "../services/jobSources.js";
import { JobSkillsExtractionSchema } from "shared";

// Normalize a skill for comparison: "React.js" ≈ "reactjs" ≈ "React"
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

// --- Experience-level awareness (Saurabh's fix: no senior jobs for freshers) ---
const SENIOR_RE = /\b(senior|sr\.?|staff|principal|lead|architect|manager|head|director|vp)\b/i;
const JUNIOR_RE = /\b(junior|jr\.?|intern(ship)?|graduate|entry|fresher|trainee|associate|early.career)\b/i;

/** Candidate level from their actual experience: all internships / ≤1 role → fresher. */
export function candidateLevel(parsed) {
  const roles = parsed.experience ?? [];
  const realRoles = roles.filter((r) => !/intern|trainee/i.test(r.role ?? ""));
  if (realRoles.length === 0) return "fresher";
  if (realRoles.length <= 2) return "junior";
  return "mid";
}

/** Job seniority from its title + level field. */
export function jobSeniority(job) {
  const text = `${job.role} ${job.seniority}`;
  if (SENIOR_RE.test(text)) return "senior";
  if (JUNIOR_RE.test(text)) return "junior";
  return "mid";
}

export function scoreJob(job, resumeSkills, level = "fresher") {
  const mine = new Set(resumeSkills.map(norm));
  const matchedSkills = [];
  const missingSkills = [];
  for (const skill of job.skills) {
    const n = norm(skill);
    // match if equal or one contains the other ("node" vs "nodejs")
    const has = [...mine].some((m) => m === n || m.includes(n) || n.includes(m));
    (has ? matchedSkills : missingSkills).push(skill);
  }
  let matchPercent = job.skills.length
    ? Math.round((matchedSkills.length / job.skills.length) * 100)
    : null; // null = "couldn't assess" (no skills listed), rendered as "—"

  // Experience fit: a senior role is a poor match for a fresher no matter how
  // many skills overlap — halve its score so real matches rank above it.
  const seniority = jobSeniority(job);
  const expFit =
    (level === "fresher" || level === "junior") && seniority === "senior" ? "stretch" : "good";
  if (expFit === "stretch" && matchPercent != null) matchPercent = Math.round(matchPercent * 0.5);

  return { ...job, matchedSkills, missingSkills, matchPercent, seniority, expFit };
}

export async function fillMissingSkills(jobs) {
  // Jobs without tags get skills AI-extracted from their description — one
  // batched call for all of them (max 8) instead of one call per job.
  const needy = jobs.map((j, idx) => ({ j, idx })).filter(({ j }) => !j.skills.length && j._description).slice(0, 8);
  if (!needy.length) return jobs;
  try {
    const prompt = `Extract the technical skills required by each job description. Return JSON {"items":[{"idx":<number>,"skills":[...]}]} — one item per input, same idx.

${needy.map(({ j, idx }) => `--- idx ${idx}: ${j.role}\n${j._description.slice(0, 900)}`).join("\n")}`;
    const { items } = await getProvider().json(prompt, JobSkillsExtractionSchema);
    for (const { idx, skills } of items) if (jobs[idx]) jobs[idx].skills = skills;
  } catch {
    /* extraction is enrichment — matching still works via role text */
  }
  return jobs;
}

export async function matchJobs(resumeId) {
  const resume = await Resume.findById(resumeId);
  if (!resume?.parsed) throw Object.assign(new Error("Resume not analyzed yet"), { status: 409 });
  const profile = await Profile.findOne({ resumeId });

  const level = candidateLevel(resume.parsed);

  // Search terms: top roles from the dashboard's roleFit, else top skills —
  // plus level-appropriate terms so freshers actually see fresher jobs.
  const queries = (profile?.dashboard?.roleFit ?? [])
    .slice(0, 2)
    .map((r) => r.role.replace(SENIOR_RE, "").trim())
    .concat(resume.parsed.skills.slice(0, 1))
    .concat(level === "fresher" ? ["junior"] : [])
    .filter(Boolean)
    .slice(0, 4);

  // Fail-soft parallel fetch: a dead source contributes nothing, not an error.
  const settled = await Promise.allSettled(
    queries.flatMap((q) => [fetchRemotive(q), fetchArbeitnow(q), fetchRemoteOK(q), fetchJobicy(q)])
  );
  let jobs = settled.filter((s) => s.status === "fulfilled").flatMap((s) => s.value);
  const failures = settled.filter((s) => s.status === "rejected").length;

  // De-duplicate (same company+role from two queries).
  const seen = new Set();
  jobs = jobs.filter((j) => {
    const key = norm(j.company + j.role);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  jobs = await fillMissingSkills(jobs);
  const scored = jobs
    .map((j) => scoreJob(j, resume.parsed.skills, level))
    .map(({ _description, ...j }) => j) // drop internal field before storing
    // Good-fit jobs first, then by match %.
    .sort(
      (a, b) =>
        (a.expFit === "good" ? 0 : 1) - (b.expFit === "good" ? 0 : 1) ||
        (b.matchPercent ?? -1) - (a.matchPercent ?? -1)
    )
    .slice(0, 40);

  const doc = await JobMatch.findOneAndUpdate(
    { resumeId },
    { resumeId, jobs: scored, queries, expiresAt: new Date(Date.now() + 48 * 3600 * 1000) },
    { upsert: true, new: true }
  );
  return { doc, failures, sourcesTried: settled.length };
}
