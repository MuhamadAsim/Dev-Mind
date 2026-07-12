// ============================================================
// CharacterChunkingStrategy
//
// Splits text by character count with a configurable overlap window.
// This is a simple, fast baseline strategy that works well for
// most document types without requiring a tokenizer dependency.
//
// Default: 800 characters per chunk, 100 character overlap.
//
// Algorithm:
//   pos = 0
//   while pos < text.length:
//     end = min(pos + chunkSize, text.length)
//     emit chunk text[pos..end], store charStart=pos, charEnd=end
//     pos += (chunkSize - overlap)   // step forward by stride
// ============================================================
import type { ChunkingStrategy, ChunkOptions } from './types';
import type { ChunkResult } from '../types';

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 100;

export class CharacterChunkingStrategy implements ChunkingStrategy {
  readonly name = 'character';

  chunk(text: string, options?: ChunkOptions): ChunkResult[] {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlap = options?.overlap ?? DEFAULT_OVERLAP;

    if (chunkSize <= 0) throw new Error('chunkSize must be > 0');
    if (overlap < 0) throw new Error('overlap must be >= 0');
    if (overlap >= chunkSize) throw new Error('overlap must be < chunkSize');

    const results: ChunkResult[] = [];
    const stride = chunkSize - overlap;
    let pos = 0;
    let index = 0;

    while (pos < text.length) {
      const end = Math.min(pos + chunkSize, text.length);
      const chunkText = text.slice(pos, end);

      // Skip entirely-whitespace chunks that can arise from empty pages
      if (chunkText.trim().length > 0) {
        results.push({
          index,
          text: chunkText,
          charStart: pos,
          charEnd: end,
        });
        index++;
      }

      if (end === text.length) break;
      pos += stride;
    }

    return results;
  }
}
