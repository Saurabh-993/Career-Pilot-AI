// Practice set generation — 30 REAL interview/exam-style questions per set,
// built as three parallel tiered batches (10 easy + 10 medium + 10 hard):
// one giant 30-question response breaks JSON too often, and tiering
// guarantees the easy→hard progression instead of hoping the model balances.
// Still ADAPTIVE: recent weak topics get more questions, strong get harder.
import { Resume } from "../models/Resume.js";
import { PracticeSet } from "../models/PracticeSet.js";
import { getProvider } from "../ai/provider.js";
import { PracticeBatchSchema } from "shared";
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
  standard: `a STANDARD tech-company screening: aptitude/logical reasoning, DSA & complexity, CS fundamentals (OS/DBMS/networks), and situational HR judgment ("what is the best response" style). Model them on REAL screening tests (TCS NQT, Infosys, Wipro, Amazon/Google online assessments, GATE-style CS questions)`,
  company: (company) => `the ACTUAL interview pattern of ${company}: their known rounds, favorite topics, question style and real past questions candidates report from ${company} interviews and online assessments`,
  resume: `the candidate's OWN resume: their claimed skills, projects and experience — the REAL questions interviewers ask after reading it (include code-output questions in their languages)`,
};

function batchPrompt({ brief, difficulty, level, perf, parsed, mode }) {
  return `You are a technical interviewer. Create practice MCQs focused on ${brief}.

Return JSON {"questions":[...]} with EXACTLY 10 questions, ALL difficulty "${difficulty}", each:
{"q" (code snippets in \`\`\` fences where relevant), "options" (exactly 4, believable distractors), "answerIdx" (0-3, verify by mentally executing), "topic", "difficulty":"${difficulty}", "explanation" (1-3 teaching sentences)}

These must feel like REAL questions from actual interviews and exams — practical, specific, the kind that appears in real screenings — never made-up trivia.
Candidate level: ${level} — "${difficulty}" is relative to that level.
${Object.keys(perf).length ? `ADAPTIVE — recent per-topic accuracy: ${JSON.stringify(perf)}. Weight MORE questions toward topics below 60%; for topics above 80%, probe deeper edge cases.` : ""}
CANDIDATE PROFILE: skills=${JSON.stringify(parsed.skills)}${mode === "resume" ? `; projects=${JSON.stringify(parsed.projects)}; experience=${JSON.stringify(parsed.experience)}` : ""}`;
}

export async function generatePractice(resumeId, mode, company = "") {
  const resume = await Resume.findById(resumeId);
  if (!resume?.parsed) throw Object.assign(new Error("Resume not analyzed yet"), { status: 409 });

  const perf = await recentPerformance(resumeId);
  const level = candidateLevel(resume.parsed);
  const brief = mode === "company" ? MODE_BRIEF.company(company) : MODE_BRIEF[mode];

  // Three tiered batches in parallel → merged easy → medium → hard.
  const provider = getProvider();
  const batches = await Promise.all(
    ["easy", "medium", "hard"].map((difficulty) =>
      provider.json(
        batchPrompt({ brief, difficulty, level, perf, parsed: resume.parsed, mode }),
        PracticeBatchSchema,
        { temperature: 0.85 }
      )
    )
  );
  const questions = batches.flatMap((b, i) =>
    // Force the tier label — models occasionally drift.
    b.questions.map((q) => ({ ...q, difficulty: ["easy", "medium", "hard"][i] }))
  );

  return PracticeSet.create({ resumeId, mode, company, questions });
}
