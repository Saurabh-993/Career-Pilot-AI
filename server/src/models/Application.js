// Application tracking — "Applied 3 days ago" badges + future analytics.
import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema(
  {
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    role: { type: String, required: true },
    company: { type: String, default: "" },
    applyUrl: { type: String, default: "" },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
// One application per (resume, company, role)
ApplicationSchema.index({ resumeId: 1, company: 1, role: 1 }, { unique: true });

export const Application = mongoose.model("Application", ApplicationSchema);
