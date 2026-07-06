// ============================================================
// AI Layer — Shared Types
// ============================================================

/** A single message in an AI conversation */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * A staged (not-yet-applied) file write or directory creation.
 * Created by proposeFileWrite/proposeCreateDirectory tools, persisted to
 * the conversation's DB metadata by route.ts, and only ever turned into
 * a real filesystem/GitHub write by route.ts's confirmation gate — never
 * by an LLM tool call.
 */
export interface PendingWrite {
  action: 'writeFile' | 'createDirectory';
  repoId: string;
  repoName: string;
  /** Path relative to repo root */
  path: string;
  /** Present only for 'writeFile' */
  content?: string;
  /** GitHub commit message override; ignored for local repos */
  commitMessage?: string;
  proposedAt: string; // ISO timestamp
}

/**
 * Mutable, per-request context threaded through every tool call in a turn.
 */
export interface ChatSession {
  activeRepoId: string | null;
  /**
   * Set by proposeFileWrite/proposeCreateDirectory during a turn.
   * route.ts reads this after streaming ends and persists it to the
   * conversation's DB metadata, then checks it on the NEXT user message
   * to decide whether to actually perform the write.
   */
  pendingWrite?: PendingWrite | null;
}

export interface AIProvider {
  stream(
    messages: AIMessage[],
    model: string,
    instructions: string | undefined,
    session: ChatSession
  ): Promise<ReadableStream<string>>;
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}