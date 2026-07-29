// Profile — one per resume: the AI-generated dashboard metrics.
// Separate from Resume so regenerating metrics never touches the source data.
import mongoose from "mongoose";

const ProfileSchema = new mongoose.Schema(
  {
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true, unique: true },
    dashboard: { type: Object, required: true }, // shape = shared/DashboardSchema
  },
  { timestamps: true }
);

export const Profile = mongoose.model("Profile", ProfileSchema);
