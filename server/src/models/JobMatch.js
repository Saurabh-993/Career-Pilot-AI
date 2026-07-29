// Cached job matches per resume. The TTL index makes MongoDB auto-delete
// documents when expiresAt passes — cache invalidation for free.
import mongoose from "mongoose";

const JobMatchSchema = new mongoose.Schema(
  {
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true, unique: true },
    jobs: { type: Array, required: true }, // NormalizedJob + { matchPercent, matchedSkills, missingSkills }
    queries: { type: Array, default: [] }, // what we searched for (debuggability)
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
JobMatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

export const JobMatch = mongoose.model("JobMatch", JobMatchSchema);
