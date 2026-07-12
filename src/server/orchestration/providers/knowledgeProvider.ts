// ============================================================
// Knowledge Provider
//
// Retrieves semantically relevant document chunks from Knowledge
// Bases using the existing RetrievalService (vector search).
// Does NOT duplicate any vector search or embedding logic.
//
// Stateless — no shared state with other providers.
// ============================================================
import type { RouterInput, ProviderResult, IContextProvider, ContextEntry } from '../types';
import { retrieve } from '../../knowledge/retrievalService';

/** Maximum number of chunks to retrieve from the vector store. */
const MAX_CHUNKS = 5;

/**
 * Minimum cosine similarity score required to include a chunk.
 * Chunks below this threshold are too loosely related to be useful.
 */
const MIN_RELEVANCE_SCORE = 0.3;

export class KnowledgeProvider implements IContextProvider {
  readonly name = 'knowledge' as const;

  async provide(input: RouterInput): Promise<ProviderResult | null> {
    const { userMessage } = input;
    console.log(`\n[knowledgeProvider DEBUG] provide() called with userMessage: "${userMessage}"`);

    try {
      // Delegate entirely to the existing RetrievalService —
      // no vector search logic is duplicated here.
      console.log(`[knowledgeProvider DEBUG] Calling retrievalService.retrieve() with limit: ${MAX_CHUNKS}...`);
      const chunks = await retrieve(userMessage, { limit: MAX_CHUNKS });
      
      console.log(`[knowledgeProvider DEBUG] retrievalService.retrieve() returned ${chunks.length} chunks:`);
      chunks.forEach((c, idx) => {
        console.log(`  - Chunk #${idx}: documentId=${c.documentId}, index=${c.index}, score=${c.score}, text length=${c.text.length}, text preview="${c.text.slice(0, 100).replace(/\r?\n/g, ' ')}..."`);
      });

      // Filter by minimum relevance score to avoid injecting noise
      const relevant = chunks.filter(c => c.score >= MIN_RELEVANCE_SCORE);
      console.log(`[knowledgeProvider DEBUG] Number of chunks >= MIN_RELEVANCE_SCORE (${MIN_RELEVANCE_SCORE}): ${relevant.length}`);

      if (relevant.length === 0) {
        console.log('[knowledgeProvider DEBUG] No chunks above relevance threshold.');
        return null;
      }

      const entries: ContextEntry[] = relevant.map(chunk => ({
        type: 'chunk',
        content: chunk.text,
        score: chunk.score,
        source: chunk.documentId,
        metadata: {
          chunkId: chunk.chunkId,
          chunkIndex: chunk.index,
          knowledgeBaseId: chunk.knowledgeBaseId,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
        },
      }));

      console.log(
        `[knowledgeProvider DEBUG] Returning ${relevant.length} relevant entries (scores: ${relevant.map(c => c.score.toFixed(4)).join(', ')})`
      );

      return {
        provider: 'knowledge',
        entries,
        metadata: {
          retrieved: relevant.length,
          minScore: Math.min(...relevant.map(c => c.score)),
          maxScore: Math.max(...relevant.map(c => c.score)),
        },
      };
    } catch (err: any) {
      console.error('[knowledgeProvider DEBUG] ERROR during retrieve:', err?.message ?? err, err.stack);
      return null;
    }
  }
}

