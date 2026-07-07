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
 */
export interface PendingWrite {
  action: 'writeFile' | 'createDirectory';
  repoId: string;
  repoName: string;
  path: string;
  content?: string;
  commitMessage?: string;
  proposedAt: string;
}

export interface ChatSession {
  activeRepoId: string | null;
  pendingWrite?: PendingWrite | null;
}

/**
 * NEW: one unit from the model's multi-step stream, normalized so
 * route.ts doesn't need to know anything about the AI SDK's internal
 * shapes. Text and tool activity travel through the SAME stream now,
 * in the order they actually happened.
 */
export type ChatStreamPart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown };

export interface AIProvider {
  stream(
    messages: AIMessage[],
    model: string,
    instructions: string | undefined,
    session: ChatSession
  ): Promise<ReadableStream<ChatStreamPart>>; // CHANGED: was ReadableStream<string>
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}