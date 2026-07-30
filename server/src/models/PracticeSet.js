// A practice question set + the user's progress on it.
import mongoose from "mongoose";

const PracticeSetSchema = new mongoose.Schema(
  {
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    mode: { type: String, enum: ["standard", "company", "resume"], required: true },
    company: { type: String, default: "" },
    questions: { type: Array, required: true }, // answers live ONLY here (server)
    responses: { type: Array, default: [] }, // { qIdx, answerIdx, correct }
    status: { type: String, enum: ["active", "finished"], default: "active" },
    score: { type: Number, default: null },
    byTopic: { type: Object, default: null },
  },
  { timestamps: true }
);

export const PracticeSet = mongoose.model("PracticeSet", PracticeSetSchema);
