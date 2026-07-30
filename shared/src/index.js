// shared/ — zod schemas used by BOTH client and server.
// One source of truth for data shapes: the server validates AI output against
// these, and the client can trust anything it receives already matches them.
// Real schemas (Resume, Profile, JobMatch…) arrive in Phase 1 per PLAN.md §7.

import { z } from "zod";

// Tiny demo schema (used by tests / the AI smoke test as a pattern to copy):
export const HealthSchema = z.object({
  ok: z.boolean(),
  uptimeSeconds: z.number(),
  groqKeyConfigured: z.boolean(),
});

// What the AI must extract from a resume (PLAN.md §7 Resume.parsed).
// .default() / .nullable() make the schema forgiving where models often
// omit fields — strict on structure, lenient on optioanl details.
export const ResumeParsedSchema = z.object({
  name: z.string().default(""), // candidate's name — used for the greeting
  summary: z.string().describe("2-3 sentence professional summary"),
  skills: z.array(z.string()).default([]),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().default(""),
        technologies: z.array(z.string()).default([]),
      })
    )
    .default([]),
  experience: z
    .array(
      z.object({
        role: z.string(),
        company: z.string().default(""),
        duration: z.string().nullable().default(null),
        highlights: z.array(z.string()).default([]),
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        degree: z.string(),
        institution: z.string().default(""),
        year: z.string().nullable().default(null),
      })
    )
    .default([]),
  links: z.array(z.string()).default([]),
});

// One job listing after normalization — EVERY source (API, scrape, pasted JD)
// funnels into this exact shape (PLAN.md §6).
export const NormalizedJobSchema = z.object({
  role: z.string(),
  company: z.string().default(""),
  location: z.string().default(""),
  remote: z.boolean().default(false),
  seniority: z.string().default(""),
  salary: z.string().nullable().default(null),
  skills: z.array(z.string()).default([]),
  applyUrl: z.string().default(""),
  source: z.string().default("manual"),
  postedAt: z.string().nullable().default(null),
});

// AI batch-extraction of skills from job descriptions that lack tags.
export const JobSkillsExtractionSchema = z.object({
  items: z.array(z.object({ idx: z.number().int(), skills: z.array(z.string()) })),
});

// AI parse of pasted JD text / scraped page (may contain several jobs).
// skills.min(3) forces real extraction — an empty skills array made pasted
// jobs show "—" instead of a match % (bug found by Saurabh).
export const JobsFromTextSchema = z.object({
  jobs: z
    .array(NormalizedJobSchema.extend({ skills: z.array(z.string()).min(3) }))
    .min(1)
    .max(10),
});

// Resume tailoring for a specific job.
export const TailorSchema = z.object({
  tailoredSummary: z.string(),
  keywordsToAdd: z.array(z.string()).default([]),
  bulletImprovements: z
    .array(z.object({ original: z.string(), improved: z.string(), why: z.string().default("") }))
    .default([]),
  tailoredResumeMd: z.string(), // full tailored resume as markdown
});

// Fastest-path learning roadmap (rendered with React Flow, roadmap.sh style).
export const RoadmapSchema = z.object({
  targetRole: z.string(),
  summary: z.string().default(""),
  totalEstHours: z.number().default(0),
  steps: z
    .array(
      z.object({
        title: z.string(),
        kind: z.enum(["skill", "project", "practice", "milestone"]),
        estHours: z.number(),
        why: z.string().default(""),
        resources: z.array(z.object({ title: z.string(), url: z.string().default("") })).default([]),
      })
    )
    .min(4)
    .max(12),
});

// Profiling quiz the AI must generate from a resume (PLAN.md §7 ProfilingQuiz).
export const QuizSchema = z.object({
  questions: z
    .array(
      z.object({
        q: z.string(), // may contain a code snippet in markdown fences
        options: z.array(z.string()).length(4),
        answerIdx: z.number().int().min(0).max(3), // NEVER sent to the client
        topic: z.string(), // e.g. "React", "SQL" — from the candidate's skills
        difficulty: z.enum(["easy", "medium", "hard"]),
        explanation: z.string(),
      })
    )
    .min(12)
    .max(18), // target: exactly 15 (5 easy / 5 medium / 5 hard)
});

// One BATCH of practice questions (a full set = 3 batches: easy/medium/hard,
// 10 each = 30 questions. One giant 30-question AI response breaks JSON too
// often — batching is the reliable way to go long).
export const PracticeBatchSchema = z.object({
  questions: z
    .array(
      z.object({
        q: z.string(),
        options: z.array(z.string()).length(4),
        answerIdx: z.number().int().min(0).max(3),
        topic: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        explanation: z.string(),
      })
    )
    .min(8)
    .max(12),
});

// Day-wise interview prep plan ("interview in N days").
export const PrepPlanSchema = z.object({
  company: z.string(),
  strategy: z.string().default(""), // 2-sentence overall approach
  days: z
    .array(
      z.object({
        day: z.number().int(), // 1 = today
        focus: z.string(),
        tasks: z
          .array(
            z.object({
              title: z.string(),
              kind: z.enum(["study", "practice", "mock", "revision", "apply"]),
              estMinutes: z.number(),
              // Where exactly to prepare from (free, well-known sources).
              resources: z.array(z.object({ title: z.string(), url: z.string().default("") })).default([]),
            })
          )
          .min(2)
          .max(6),
      })
    )
    .min(1)
    .max(30),
});

// Dashboard metrics the AI must generate from a parsed resume (PLAN.md §7 Profile.dashboard).
export const DashboardSchema = z.object({
  atsScore: z.number().min(0).max(100),
  atsTips: z.array(z.string()).default([]),
  strengths: z.array(z.object({ title: z.string(), detail: z.string().default("") })).default([]),
  gaps: z.array(z.object({ title: z.string(), detail: z.string().default("") })).default([]),
  inDemandTech: z
    .array(
      z.object({
        name: z.string(),
        demand: z.number().min(0).max(100), // current market demand
        hasSkill: z.boolean(), // does the candidate already have it?
      })
    )
    .default([]),
  roleFit: z
    .array(
      z.object({
        role: z.string(),
        matchPercent: z.number().min(0).max(100),
        reason: z.string().default(""),
      })
    )
    .default([]),
});
