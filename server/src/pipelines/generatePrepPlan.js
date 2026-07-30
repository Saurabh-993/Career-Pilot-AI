// "Interview in N days" — day-wise prep plan for a specific company.
import { Resume } from "../models/Resume.js";
import { Profile } from "../models/Profile.js";
import { PrepPlan } from "../models/PrepPlan.js";
import { getProvider } from "../ai/provider.js";
import { PrepPlanSchema } from "shared";
import { candidateLevel } from "./matchJobs.js";

export async function generatePrepPlan(resumeId, company, interviewDate) {
  const resume = await Resume.findById(resumeId);
  if (!resume?.parsed) throw Object.assign(new Error("Resume not analyzed yet"), { status: 409 });
  const profile = await Profile.findOne({ resumeId });

  const daysLeft = Math.max(1, Math.ceil((new Date(interviewDate) - Date.now()) / 86400000));
  if (daysLeft > 30)
    throw Object.assign(new Error("Prep plans support up to 30 days out — pick a closer date"), { status: 400 });

  const prompt = `You are an interview coach. The candidate has an interview at "${company}" in EXACTLY ${daysLeft} day(s). Build a realistic day-by-day preparation plan.

Return JSON {"company","strategy" (2 sentences),"days":[{"day" (1=today, up to ${daysLeft}),"focus","tasks":[{"title" (specific and actionable, mention exact topics/question types),"kind":"study"|"practice"|"mock"|"revision","estMinutes"}]}]}

Rules:
- EXACTLY ${daysLeft} day entries. 2-4 hours of tasks per day (realistic for someone also living life).
- Structure: fundamentals & gaps early → company-specific patterns middle → mocks + revision at the end. Final day = light revision + logistics, never cramming.
- Target ${company}'s actual interview style and rounds. Prioritize the candidate's weak areas.
- Candidate level: ${candidateLevel(resume.parsed)}${profile?.verifiedLevel ? ` (verified: ${profile.verifiedLevel.level})` : ""}.

CANDIDATE: skills=${JSON.stringify(resume.parsed.skills)}; gaps=${JSON.stringify(profile?.dashboard?.gaps?.map((g) => g.title) ?? [])}`;

  const plan = await getProvider().json(prompt, PrepPlanSchema, { temperature: 0.5 });
  return PrepPlan.create({ resumeId, company, interviewDate, plan, done: {} });
}
