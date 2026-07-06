// ============================================================
// AI Service
// Single entry-point for all AI operations.
// Business logic (system prompt, message formatting) lives here.
// Provider selection and initialization also happens here.
// API routes call streamChat() — they never touch a provider directly.
// ============================================================
import type { AIMessage, AIProvider } from './types';
import { createOpenRouterProvider } from './providers/openrouter';

// ── System Prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are DevMind AI, a personal AI software engineering assistant.
You help developers write, understand, debug, review, and improve code.
You are precise, concise, and technically accurate.
When writing code, always use proper syntax highlighting with fenced code blocks.
When you are unsure, say so rather than guessing.`;

// ── Default model ─────────────────────────────────────────────
// Configurable via environment variable — no hardcoded model IDs
// in business logic. Change DEFAULT_AI_MODEL in .env.local to switch.
const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL ?? 'openai/gpt-4o-mini';

// ── Provider initialization ───────────────────────────────────
// To add a new provider (e.g. Anthropic, Gemini, Ollama):
//   1. Create src/server/ai/providers/<name>.ts implementing AIProvider
//   2. Add a case below
//   3. Set ACTIVE_AI_PROVIDER env var
function createProvider(): AIProvider {
  const provider = process.env.ACTIVE_AI_PROVIDER ?? 'openrouter';

  switch (provider) {
    case 'openrouter':
      return createOpenRouterProvider({
        apiKey: process.env.OPENROUTER_API_KEY ?? '',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: DEFAULT_MODEL,
      });

    // Future providers:
    // case 'openai':
    //   return createOpenAIProvider({ apiKey: process.env.OPENAI_API_KEY ?? '' });
    // case 'anthropic':
    //   return createAnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
    // case 'gemini':
    //   return createGeminiProvider({ apiKey: process.env.GOOGLE_API_KEY ?? '' });

    default:
      throw new Error(`Unknown AI provider: "${provider}". Set ACTIVE_AI_PROVIDER in .env.local.`);
  }
}

// Singleton — provider is constructed once per server process
let _provider: AIProvider | null = null;
function getProvider(): AIProvider {
  if (!_provider) _provider = createProvider();
  return _provider;
}

// ── Context Window Configuration ──────────────────────────────────
// Configurable via environment variable — no hardcoded value
const MAX_CONTEXT_MESSAGES = (() => {
  const envVal = process.env.MAX_CONTEXT_MESSAGES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 20; // Default fallback
})();

// ── Public API ────────────────────────────────────────────────

export interface StreamChatOptions {
  /** Full conversation history including the latest user message */
  messages: AIMessage[];
  /** Override the default model for this request */
  model?: string;
  /** Active repository ID selected in the UI */
  activeRepoId?: string | null;
}

/**
 * Truncates conversation messages using a sliding window strategy.
 * This ensures that we only send the most recent N messages to the LLM
 * to avoid exceeding the model's context window.
 * 
 * Future Upgrade Points:
 * 1. Token-based context management:
 *    - Instead of message count, we can count/estimate tokens of each message (e.g. using tiktoken or approximate char/word ratio).
 *    - Truncate messages dynamically when they exceed a target token limit (e.g., 80% of model context window).
 * 2. Automatic conversation summarization:
 *    - If messages exceed a certain length/limit, trigger an LLM-based summarization of the older history.
 *    - Prepend the summary as context before the active sliding window of messages.
 * 3. Semantic Memory (RAG):
 *    - Retrieve older messages or relevant code context via semantic search in a vector database.
 *    - Inject these retrieved chunks as background context into the prompt.
 */
export function truncateConversationContext(
  messages: AIMessage[],
  maxMessages: number = MAX_CONTEXT_MESSAGES
): AIMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }
  // Sliding window: keep only the most recent N messages
  console.log(
    `[aiService] Sliding window applied: limiting conversation context from ${messages.length} messages to the most recent ${maxMessages} messages.`
  );
  return messages.slice(-maxMessages);
}

/**
 * Stream a chat response.
 * @returns A ReadableStream of text chunks suitable for SSE streaming.
 */
export async function streamChat(options: StreamChatOptions): Promise<ReadableStream<string>> {
  const { messages, model = DEFAULT_MODEL, activeRepoId } = options;

  // Apply the sliding window strategy to limit context sent to the provider.
  const truncatedMessages = truncateConversationContext(messages);

  // Prepend system prompt — invisible to the user but shapes AI behavior
  // Pass the system prompt separately as instructions.
  // Newer AI SDK versions don't allow system messages in `messages`.
  return getProvider().stream(truncatedMessages, model, SYSTEM_PROMPT, activeRepoId);
}

/** Expose the resolved default model (useful for displaying in the UI) */
export { DEFAULT_MODEL, MAX_CONTEXT_MESSAGES };
