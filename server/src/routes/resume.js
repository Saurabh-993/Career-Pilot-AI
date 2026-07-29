// Resume routes — Step 1: upload a PDF, extract its text, store it.
//
// Browsers send files as multipart/form-data (a format that mixes text fields
// and binary file chunks). Express can't decode that alone — multer does, and
// hands us the file as req.file with the bytes in req.file.buffer (memory
// storage: we never write the PDF to disk — less to secure, and we only need
// the text).

import { Router } from "express";
// GOTCHA (real-world lesson): importing "pdf-parse" directly runs the
// library's own debug test file and crashes in ESM. Importing the inner
// module skips that. Documented in PROJECT_GUIDE.md §20.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import multer from "multer";
import { Resume } from "../models/Resume.js";
import { ingestResume } from "../pipelines/ingestResume.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB cap — resumes are small; blocks abuse
});

export const resumeRouter = Router();

// POST /api/resume/upload  (form field name must be "file")
resumeRouter.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    // --- Input validation first: never trust incoming data ---
    if (!req.file) {
      const e = new Error("No file received — the form field must be named 'file'");
      e.status = 400; // 400 = client mistake, not server failure
      throw e;
    }
    if (req.file.mimetype !== "application/pdf") {
      const e = new Error("Only PDF files are supported for now");
      e.status = 400;
      throw e;
    }

    // --- Extract text from the PDF's text layer ---
    const data = await pdfParse(req.file.buffer);

    // Light cleanup: PDFs produce messy whitespace; normalize it.
    const rawText = data.text
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // A scanned (image-only) PDF has no text layer → almost nothing extracted.
    if (rawText.length < 100) {
      const e = new Error(
        "Could not extract text — this looks like a scanned/image PDF. OCR support is a future improvement; please upload a text-based PDF."
      );
      e.status = 422; // 422 = understood the request, but the content can't be processed
      throw e;
    }

    // --- Store in MongoDB ---
    const doc = await Resume.create({
      fileName: req.file.originalname,
      rawText,
      stats: {
        pages: data.numpages,
        words: rawText.split(/\s+/).length,
        characters: rawText.length,
      },
    });

    // Fire the AI pipeline in the BACKGROUND (no await!) — the request
    // returns immediately and the client polls GET /:id for progress.
    ingestResume(doc._id);

    // Return a small summary — never the whole text (keep responses lean).
    res.json({
      ok: true,
      resumeId: doc._id,
      fileName: doc.fileName,
      stats: doc.stats,
      preview: rawText.slice(0, 600),
    });
  } catch (err) {
    next(err); // central error handler formats it as clean JSON
  }
});

// GET /api/resume/:id — polled by the UI while the pipeline runs.
resumeRouter.get("/:id", async (req, res, next) => {
  try {
    const doc = await Resume.findById(req.params.id).select("-rawText"); // exclude the big text field
    if (!doc) {
      const e = new Error("Resume not found");
      e.status = 404;
      throw e;
    }
    res.json({
      ok: true,
      resumeId: doc._id,
      fileName: doc.fileName,
      stats: doc.stats,
      status: doc.status, // parsing | ready | failed
      parsed: doc.parsed,
      error: doc.error,
    });
  } catch (err) {
    next(err);
  }
});
