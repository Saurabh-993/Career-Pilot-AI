// Quiz pipeline v2: 15 personalized MCQs in three difficulty tiers,
// broad topic coverage, max 3 attempts per resume, no repeated questions.
import { Resume } from "../models/Resume.js";
import { Quiz } from "../models/Quiz.js";
import { getProvider } from "../ai/provider.js";
import { QuizSchema } from "shared";

export const MAX_ATTEMPTS = 3;

function quizPrompt(parsed, avoidQuestions) {
  return `You are a technical interviewer. Create a profiling quiz to verify this candidate's ACTUAL level in the skills they claim.

Return JSON: {"questions": [...]} with EXACTLY 15 questions:
- EXACTLY 5 "easy", 5 "medium", 5 "hard".
- COVER THE BREADTH of the candidate's skills: at most 2 questions per topic, and prioritize the topics most frequently asked in real job interviews for their target roles.
- At least 5 questions must include a short code snippet (in a markdown \`\`\` fence) asking "what is the output?" — in languages the candidate claims.
- Hard questions should test depth real interviews probe: edge cases, async behavior, complexity, gotchas — never obscure trivia.

Each question object:
- "q", "options" (exactly 4; distractors = believable mistakes), "answerIdx" (0-3),
- "topic" (one of their skill names), "difficulty", "explanation" (1-3 sentences teaching WHY).

Rules: only test skills from their profile; mentally execute code before choosing answerIdx; no typo tricks.
${avoidQuestions.length ? `\nThis is a RE-ATTEMPT. Do NOT repeat or lightly rephrase any of these previous questions:\n${avoidQuestions.map((q) => `- ${q.slice(0, 120)}`).join("\n")}` : ""}

CANDIDATE PROFILE:
${JSON.stringify({ skills: parsed.skills, projects: parsed.projects, experience: parsed.experience }, null, 2)}`;
}

export async function generateQuiz(resumeId) {
  const resume = await Resume.findById(resumeId);
  if (!resume) throw Object.assign(new Error("Resume not found"), { status: 404 });
  if (resume.status !== "ready" || !resume.parsed)
    throw Object.assign(new Error("Resume analysis not finished yet"), { status: 409 });

  // Attempt cap: verified level should reflect work, not luck.
  const attempts = await Quiz.countDocuments({ resumeId });
  if (attempts >= MAX_ATTEMPTS)
    throw Object.assign(
      new Error(`Maximum ${MAX_ATTEMPTS} attempts reached for this resume. Time to study and update your resume with new skills!`),
      { status: 403 }
    );

  // Collect previous questions so re-attempts get fresh ones.
  const previous = await Quiz.find({ resumeId }).select("questions.q");
  const avoid = previous.flatMap((quiz) => quiz.questions.map((x) => x.q));

  // temperature 0.9: maximize variety so every attempt gets a truly
  // different set (combined with the explicit avoid-list in the prompt).
  const { questions } = await getProvider().json(quizPrompt(resume.parsed, avoid), QuizSchema, {
    temperature: 0.9,
  });
  const quiz = await Quiz.create({ resumeId, questions });
  return { quiz, attempt: attempts + 1, attemptsLeft: MAX_ATTEMPTS - attempts - 1 };
}
