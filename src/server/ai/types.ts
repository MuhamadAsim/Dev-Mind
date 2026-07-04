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
 * Provider abstraction.
 * Every provider (OpenRouter, OpenAI, Anthropic, Gemini, Ollama, …)
 * must implement this interface.
 */
export interface AIProvider {
  /**
   * Stream a chat completion.
   * @param messages  Full conversation history
   * @param model     Model identifier (provider-specific string)
   * @returns         A ReadableStream of text chunks
   */
  stream(
    messages: AIMessage[],
    model: string,
    instructions?: string
  ): Promise<ReadableStream<string>>;
}

/** Config shape passed to each provider factory */
export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  /** Optional default model for this provider */
  defaultModel?: string;
}
