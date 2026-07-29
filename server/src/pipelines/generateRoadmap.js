// Fastest-path roadmap: missing skills + candidate level → ordered learning
// plan (validated), rendered client-side with React Flow.
import { Resume } from "../models/Resume.js";
import { Profile } from "../models/Profile.js";
import { Roadmap } from "../models/Roadmap.js";
import { getProvider } from "../ai/provider.js";
import { RoadmapSchema } from "shared";

export async function generateRoadmap(resumeId, targetRole, missingSkills = []) {
  const resume = await Resume.findById(resumeId);
  if (!resume?.parsed) throw Object.assign(new Error("Resume not analyzed yet"), { status: 409 });
  const profile = await Profile.findOne({ resumeId });

  const prompt = `You are a pragmatic career mentor. Create the FASTEST realistic path for this candidate to become job-ready for: "${targetRole}".

Return JSON matching:
{"targetRole","summary" (2 sentences),"totalEstHours","steps":[{"title","kind":"skill"|"project"|"practice"|"milestone","estHours","why" (1 sentence),"resources":[{"title","url"}] (1-3, prefer FREE well-known ones: official docs, freeCodeCamp, roadmap.sh, YouTube)}]}

Rules:
- 6-10 steps, ORDERED — each builds on the previous (this becomes a visual roadmap).
- Skip what they already know (their skills below). Focus on: ${missingSkills.length ? missingSkills.join(", ") : "the gap between their profile and the role"}.
- Include at least one "project" step (portfolio proof) and end with a "milestone" step (interview-ready).
- estHours must be honest for someone at their level${profile?.verifiedLevel ? ` (verified level: ${profile.verifiedLevel.level})` : ""}.

CANDIDATE: skills=${JSON.stringify(resume.parsed.skills)}; experience=${JSON.stringify(resume.parsed.experience?.map((e) => e.role))}`;

  const roadmap = await getProvider().json(prompt, RoadmapSchema);
  const doc = await Roadmap.findOneAndUpdate(
    { resumeId, targetRole },
    { resumeId, targetRole, roadmap },
    { upsert: true, new: true }
  );
  return doc;
}
