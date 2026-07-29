// Cached fastest-path roadmaps, one per (resume, target role).
import mongoose from "mongoose";

const RoadmapSchema = new mongoose.Schema(
  {
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true },
    targetRole: { type: String, required: true },
    roadmap: { type: Object, required: true }, // shape = shared/RoadmapSchema
  },
  { timestamps: true }
);
RoadmapSchema.index({ resumeId: 1, targetRole: 1 }, { unique: true });

export const Roadmap = mongoose.model("Roadmap", RoadmapSchema);
