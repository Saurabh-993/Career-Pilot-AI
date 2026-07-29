// ProfilingQuiz — one attempt at verifying the candidate's level.
// Questions (WITH answers) live only here on the server; the client never
// receives answerIdx until after answering — grading is server-side.
import mongoose from "mongoose";

const QuizSchema = new mongoose.Schema(
  {
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true },
    questions: { type: Array, required: true }, // shape = shared/QuizSchema.questions
    // One entry per answered question: { qIdx, answerIdx, correct }
    responses: { type: Array, default: [] },
    status: { type: String, enum: ["active", "finished"], default: "active" },
    score: { type: Number, default: null }, // percent, set on finish
    byTopic: { type: Object, default: null }, // { topic: { correct, total } }
  },
  { timestamps: true }
);

export const Quiz = mongoose.model("Quiz", QuizSchema);
