// Day-wise prep plan for a specific company interview.
import mongoose from "mongoose";

const PrepPlanSchema = new mongoose.Schema(
  {
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    company: { type: String, required: true },
    interviewDate: { type: Date, required: true },
    plan: { type: Object, required: true }, // shape = shared/PrepPlanSchema
    // Task completion map: { "dayIdx-taskIdx": true }
    done: { type: Object, default: {} },
  },
  { timestamps: true, minimize: false } // minimize:false keeps empty {} (mongoose drops them otherwise)
);

export const PrepPlan = mongoose.model("PrepPlan", PrepPlanSchema);
