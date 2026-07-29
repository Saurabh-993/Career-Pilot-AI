// Qdrant wrapper — our vector database (stores embeddings + finds nearest ones).
import { QdrantClient } from "@qdrant/js-client-rest";
import { randomUUID } from "node:crypto";
import { EMBEDDING_DIM } from "../ai/embeddings.js";

const COLLECTION = "resume_chunks";

let client = null;
function getClient() {
  if (!client) client = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });
  return client;
}

/** Create the collection on first use (idempotent = safe to call repeatedly). */
export async function ensureCollection() {
  const c = getClient();
  const { collections } = await c.getCollections();
  if (!collections.some((col) => col.name === COLLECTION)) {
    await c.createCollection(COLLECTION, {
      // Cosine distance = "how similar in direction are two meaning-vectors"
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
    });
  }
}

/** Store one resume's chunks. Deletes that resume's old chunks first (re-upload = replace). */
export async function upsertResumeChunks(resumeId, chunks, vectors) {
  const c = getClient();
  await c.delete(COLLECTION, {
    wait: true,
    filter: { must: [{ key: "resumeId", match: { value: String(resumeId) } }] },
  });
  await c.upsert(COLLECTION, {
    wait: true,
    points: chunks.map((text, i) => ({
      id: randomUUID(),
      vector: vectors[i],
      payload: { resumeId: String(resumeId), idx: i, text }, // payload = metadata we get back on search
    })),
  });
}

/** RAG retrieval: find the resume chunks most similar to a query vector. */
export async function searchResumeChunks(resumeId, queryVector, limit = 5) {
  const c = getClient();
  const results = await c.search(COLLECTION, {
    vector: queryVector,
    limit,
    filter: { must: [{ key: "resumeId", match: { value: String(resumeId) } }] },
  });
  return results.map((r) => ({ text: r.payload.text, score: r.score }));
}
