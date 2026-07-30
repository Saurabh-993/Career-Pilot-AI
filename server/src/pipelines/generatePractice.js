// Practice set generation — three modes, ADAPTIVE to the user's history:
// recent weak topics get more questions, strong topics get harder ones.
import { Resume } from "../models/Resume.js";
import { PracticeSet } from "../models/PracticeSet.js";
import { getProvider } from "../ai/provider.js";
import { PracticeSetSchema } from "shared";
import { candidateLevel } from "./matchJobs.js";

/** Aggregate accuracy per topic from the user's recent finished sets. */
async function recentPerformance(resumeId) {
  const sets = await PracticeSet.find({ resumeId, status: "finished" })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("byTopic");
  const agg = {};
  for (const s of sets)
    for (const [topic, t] of Object.entries(s.byTopic ?? {})) {
      const a = (agg[topic] ??= { correct: 0, total: 0 });
      a.correct += t.correct;
      a.total += t.total;
    }
  return agg;
}

const MODE_BRIEF = {
  standard: `a STANDARD tech-company screening: mix aptitude/logical reasoning (2-3), DSA & complexity (3-4), CS fundamentals — OS/DBMS/networks (2-3), and situational HR judgment (1-2, "what is the best response" style)`,
  company: (company) => `the actual interview pattern of ${company}: their known rounds, favorite topics, and question style. Reflect what ${company} genuinely emphasizes (e.g. their tech stack, values-based HR questions)`,
  resume: `the candidate's OWN resume: their claimed skills, projects and experience — the questions an interviewer would ask after reading it (include code-output questions in their languages)`,
};

export async function generatePractice(resumeId, mode, company = "") {
  const resume = await Resume.findById(resumeId);
  if (!resume?.parsed) throw Object.assign(new Error("Resume not analyzed yet"), { status: 409 });

  const perf = await recentPerformance(resumeId);
  const level = candidateLevel(resume.parsed);
  const brief = mode === "company" ? MODE_BRIEF.company(company) : MODE_BRIEF[mode];

  const prompt = `You are a technical interviewer. Create a practice MCQ set focused on ${brief}.

Return JSON {"questions":[...]} with EXACTLY 10 questions, each:
{"q" (code snippets in \`\`\` fences where relevant), "options" (exactly 4, believable distractors), "answerIdx" (0-3, verify by mentally executing), "topic", "difficulty" ("easy"|"medium"|"hard"), "explanation" (1-3 teaching sentences)}

Candidate level: ${level}. Calibrate difficulty accordingly (mix ~3 easy / 4 medium / 3 hard).
${Object.keys(perf).length ? `ADAPTIVE RULES — recent per-topic accuracy: ${JSON.stringify(perf)}. Give MORE questions on topics below 60% accuracy; make topics above 80% HARDER.` : ""}
CANDIDATE PROFILE: skills=${JSON.stringify(resume.parsed.skills)}${mode === "resume" ? `; projects=${JSON.stringify(resume.parsed.projects)}; experience=${JSON.stringify(resume.parsed.experience)}` : ""}`;

  const { questions } = await getProvider().json(prompt, PracticeSetSchema, { temperature: 0.8 });
  return PracticeSet.create({ resumeId, mode, company, questions });
}
