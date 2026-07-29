// Resume ingestion pipeline — runs in the BACKGROUND after upload:
//   1. AI structured extraction  (rawText → validated JSON: skills, projects…)
//   2. Chunking                  (split text into overlapping passages)
//   3. Embeddings                (each chunk → 384-number meaning vector, locally)
//   4. Qdrant upsert             (store vectors for later RAG retrieval)
// The Resume document's `status` field tracks progress: parsing → ready | failed.
// (LangGraph will formalize pipelines like this one when they grow branches.)

import { Resume } from "../models/Resume.js";
import { getProvider } from "../ai/provider.js";
import { embedTexts } from "../ai/embeddings.js";
import { ensureCollection, upsertResumeChunks } from "../vector/qdrant.js";
import { ResumeParsedSchema } from "shared";

/** Split text into ~200-word chunks with 40-word overlap.
 *  Overlap prevents a fact from being cut in half at a boundary. */
function chunkText(text, size = 200, overlap = 40) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let start = 0; start < words.length; start += size - overlap) {
    const chunk = words.slice(start, start + size).join(" ");
    if (chunk.length > 50) chunks.push(chunk);
    if (start + size >= words.length) break;
  }
  return chunks;
}

function extractionPrompt(rawText) {
  return `Extract structured data from this resume.

Return a JSON object with EXACTLY these keys:
- "summary": 2-3 sentence professional summary of the candidate
- "skills": array of individual technical skills (flatten grouped lists; e.g. "React, Node" → ["React", "Node"])
- "projects": array of {"name", "description", "technologies": []}
- "experience": array of {"role", "company", "duration", "highlights": []}  (internships count)
- "education": array of {"degree", "institution", "year"}
- "links": array of URLs found (GitHub, LinkedIn, portfolio…)

Only include information actually present in the resume — do not invent anything.

RESUME:
${rawText}`;
}

export async function ingestResume(resumeId) {
  const doc = await Resume.findById(resumeId);
  if (!doc) return;
  try {
    // 1. Structured extraction — zod-validated, self-retrying (groqProvider.json)
    const parsed = await getProvider().json(extractionPrompt(doc.rawText), ResumeParsedSchema);

    // 2-4. Chunk → embed → store vectors
    const chunks = chunkText(doc.rawText);
    const vectors = await embedTexts(chunks);
    await ensureCollection();
    await upsertResumeChunks(doc._id, chunks, vectors);

    doc.parsed = parsed;
    doc.status = "ready";
    doc.error = null;
    await doc.save();
    console.log(`✅ Resume ${doc._id} ingested: ${parsed.skills.length} skills, ${chunks.length} chunks`);
  } catch (err) {
    // Fail-soft: record the failure on the document so the UI can show it.
    console.error(`❌ Resume ingestion failed for ${resumeId}:`, err.message);
    doc.status = "failed";
    doc.error = err.message;
    await doc.save();
  }
}
