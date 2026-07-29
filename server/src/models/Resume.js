// The Resume model — defines what a resume document looks like in MongoDB.
// mongoose creates a "resumes" collection automatically from the model name.

import mongoose from "mongoose";

const ResumeSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    rawText: { type: String, required: true }, // full extracted text
    stats: {
      pages: Number,
      words: Number,
      characters: Number,
    },
    // Structured extraction (skills, projects, experience…) filled by the
    // background ingestion pipeline. Shape defined in shared/ResumeParsedSchema.
    parsed: { type: Object, default: null },
    // Pipeline progress — the UI polls this: parsing → ready | failed
    status: { type: String, enum: ["parsing", "ready", "failed"], default: "parsing" },
    error: { type: String, default: null },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

export const Resume = mongoose.model("Resume", ResumeSchema);
