// ============================================================
// AI Layer — Shared Types
// These interfaces decouple the rest of the application from
// any specific AI provider. Adding a new provider means
// implementing AIProvider — nothing else changes.
// ============================================================

/** A single message in an AI conversation */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Mutable, per-request context threaded through every tool call in a turn.
 *
 * WHY THIS EXISTS: previously `activeRepoId` was passed as a plain string
 * and baked into the tool definitions once, before streamText() ran. That
 * broke the moment we needed a `selectRepo` tool — if the LLM picks a repo
 * mid-conversation, tools created *before* that point were still frozen on
 * the old value.
 *
 * By passing this object (not the string) into the provider and into
 * createRepositoryTools(), every tool reads `session.activeRepoId` at
 * execute() time instead of at creation time. `selectRepo`/`disconnectRepo`
 * mutate it directly, so any tool called later in the SAME turn (your
 * multi-step loop already supports 5 steps via stopWhen) sees the update
 * immediately. route.ts also reads the final value after streaming ends,
 * to tell the client the active repo changed.
 */
export interface ChatSession {
  activeRepoId: string | null;
}

/**
 * Provider abstraction.
 * Every provider (OpenRouter, OpenAI, Anthropic, Gemini, Ollama, …)
 * must implement this interface.
 */
export interface AIProvider {
  /**
   * Stream a chat completion.
   * @param messages     Full conversation history
   * @param model        Model identifier (provider-specific string)
   * @param instructions System prompt
   * @param session      Mutable repo context — see ChatSession above.
   *                     Replaces the old plain `activeRepoId?: string | null`
   *                     param so tools can change it mid-turn.
   * @returns            A ReadableStream of text chunks
   */
  stream(
    messages: AIMessage[],
    model: string,
    instructions: string | undefined,
    session: ChatSession
  ): Promise<ReadableStream<string>>;
}

/** Config shape passed to each provider factory */
export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  /** Optional default model for this provider */
  defaultModel?: string;
}