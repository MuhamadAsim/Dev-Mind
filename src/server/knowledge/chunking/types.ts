// ============================================================
// ChunkingStrategy — interface for text chunking strategies
//
// Phase 8 ships CharacterChunkingStrategy (800 char / 100 overlap).
// Future: implement TokenChunkingStrategy using a tokenizer like
// tiktoken, then swap it in chunkingService.ts — no other changes.
// ============================================================
import type { ChunkResult } from '../types';

export interface ChunkOptions {
  /** Maximum number of characters per chunk. Default: 800 */
  chunkSize?: number;
  /** Number of characters to overlap between consecutive chunks. Default: 100 */
  overlap?: number;
}

export interface ChunkingStrategy {
  /** Stable name for this strategy — logged and stored for traceability */
  readonly name: string;
  /**
   * Split `text` into chunks and return an ordered array of ChunkResult.
   * Must be a pure function — no I/O, no side effects.
   */
  chunk(text: string, options?: ChunkOptions): ChunkResult[];
}
