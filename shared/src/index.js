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
