// Dashboard pipeline: parsed resume → AI career analysis → validated metrics.
// `emit(stage)` reports progress — the SSE route forwards each stage to the
// browser live (this is what replaced Step 2's polling).

import { Resume } from "../models/Resume.js";
import { Profile } from "../models/Profile.js";
import { getProvider } from "../ai/provider.js";
import { DashboardSchema } from "shared";

function dashboardPrompt(parsed, stats) {
  return `You are a career analyst for the tech job market (India + global, 2026).

Analyze this candidate profile and return a JSON object with EXACTLY these keys:
- "atsScore": 0-100 — how well this resume would pass Applicant Tracking Systems (keyword coverage, quantified achievements, structure). Be honest, not flattering.
- "atsTips": 3-5 specific, actionable improvements for THIS resume.
- "strengths": 3-5 {"title","detail"} — what genuinely stands out.
- "gaps": 3-5 {"title","detail"} — weaknesses or missing elements holding the candidate back.
- "inDemandTech": 8-12 {"name","demand","hasSkill"} — technologies most in demand for this candidate's target areas; "demand" = current market demand 0-100; "hasSkill" = whether the candidate already has it. Mix skills they have with high-demand ones they lack.
- "roleFit": 4-6 {"role","matchPercent","reason"} — job roles ranked by realistic fit today.

Base everything on the actual profile below — do not invent experience.

CANDIDATE PROFILE:
${JSON.stringify(parsed, null, 2)}

RESUME STATS: ${stats.pages} page(s), ${stats.words} words.`;
}

export async function generateDashboard(resumeId, emit = () => {}) {
  emit("Loading your profile…");
  const resume = await Resume.findById(resumeId);
  if (!resume) throw Object.assign(new Error("Resume not found"), { status: 404 });
  if (resume.status !== "ready" || !resume.parsed) {
    throw Object.assign(new Error("Resume analysis not finished yet — try again in a moment"), { status: 409 });
  }

  emit("Analyzing skills against the job market…");
  const dashboard = await getProvider().json(
    dashboardPrompt(resume.parsed, resume.stats),
    DashboardSchema
  );

  emit("Saving your dashboard…");
  // upsert = update if exists, insert if not (regenerate replaces cleanly)
  const profile = await Profile.findOneAndUpdate(
    { resumeId },
    { resumeId, dashboard },
    { upsert: true, new: true }
  );
  return profile;
}
