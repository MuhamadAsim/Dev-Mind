// ============================================================
// Retrieval Service
//
// Standalone retrieval pipeline:
//   Question -> Generate query embedding -> Vector search query -> Top K Chunks
//
// Decoupled design:
//   - Relies strictly on `embeddingService` and `vectorStoreProvider`.
//   - Does NOT format LLM prompts or interact with LLM models.
//   - Returns similarity score along with chunk details.
// ============================================================
import { getEmbedding } from './embeddingService';
import { vectorStoreProvider } from './storage/vectorStore';
import type { VectorStoreChunk } from './storage/vectorStoreProvider';

export interface RetrievalResult extends VectorStoreChunk {
  // similarity score is guaranteed to be populated here
  score: number;
}

export interface RetrievalOptions {
  /** Optional Knowledge Base ID to scope the vector search */
  knowledgeBaseId?: string;
  /** Maximum number of chunks to return (default: 5) */
  limit?: number;
}

/**
 * Retrieve the top-K relevant text chunks for a given query text.
 */
export async function retrieve(
  query: string,
  options?: RetrievalOptions
): Promise<RetrievalResult[]> {
  if (!query.trim()) return [];

  const limit = options?.limit ?? 5;
  const knowledgeBaseId = options?.knowledgeBaseId;

  // ── 1. Generate query embedding ───────────────────────────
  const queryVector = await getEmbedding(query);

  // ── 2. Query the vector store ─────────────────────────────
  const matchedChunks = await vectorStoreProvider.similaritySearch(queryVector, {
    knowledgeBaseId,
    limit,
  });

  // ── 3. Return results with similarity scores ──────────────
  return matchedChunks.map((chunk) => ({
    ...chunk,
    score: chunk.score ?? 0,
  }));
}
