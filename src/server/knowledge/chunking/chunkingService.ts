// ============================================================
// ChunkingService
//
// Thin facade over a ChunkingStrategy.
// Default strategy: CharacterChunkingStrategy (800 / 100 overlap).
//
// To switch strategy globally: change `defaultStrategy` below.
// To switch per-call: pass a ChunkingStrategy instance as the
// second argument to chunkText().
// ============================================================
import { CharacterChunkingStrategy } from './characterStrategy';
import type { ChunkingStrategy, ChunkOptions } from './types';
import type { ChunkResult } from '../types';

const defaultStrategy: ChunkingStrategy = new CharacterChunkingStrategy();

/**
 * Split text into chunks using the given strategy (or the default).
 *
 * @param text      - The full extracted text to chunk
 * @param strategy  - Optional override; defaults to CharacterChunkingStrategy
 * @param options   - Optional tuning params (chunkSize, overlap)
 */
export function chunkText(
  text: string,
  strategy?: ChunkingStrategy,
  options?: ChunkOptions
): ChunkResult[] {
  return (strategy ?? defaultStrategy).chunk(text, options);
}

export type { ChunkingStrategy, ChunkOptions };
