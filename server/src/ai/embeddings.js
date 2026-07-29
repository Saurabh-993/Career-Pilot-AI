// Local embeddings via fastembed — text → 384 numbers capturing meaning.
// Runs the bge-small model ON THIS MACHINE: $0, no API, no rate limits.
// First run downloads the model (~30-80 MB) into server/.cache (gitignored),
// then it's instant forever.

import { EmbeddingModel, FlagEmbedding } from "fastembed";

let modelPromise = null; // singleton — load the model once, reuse everywhere

function getModel() {
  if (!modelPromise) {
    modelPromise = FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15, // 384-dimension vectors
      cacheDir: ".cache",
    });
  }
  return modelPromise;
}

/** Embed many texts (documents/chunks). Returns number[][] — one vector per text. */
export async function embedTexts(texts) {
  const model = await getModel();
  const vectors = [];
  // fastembed yields results in batches from an async generator:
  for await (const batch of model.embed(texts)) {
    for (const vec of batch) vectors.push(Array.from(vec));
  }
  return vectors;
}

/** Embed a search query. (bge models prefix queries differently than documents.) */
export async function embedQuery(text) {
  const model = await getModel();
  return Array.from(await model.queryEmbed(text));
}

export const EMBEDDING_DIM = 384;
