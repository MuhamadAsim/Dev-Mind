// ============================================================
// AI Service
// Single entry-point for all AI operations.
// Business logic (system prompt, message formatting) lives here.
// Provider selection and initialization also happens here.
// API routes call streamChat() — they never touch a provider directly.
// ============================================================
import type { AIMessage, AIProvider, ChatSession } from './types';
import { createOpenRouterProvider } from './providers/openrouter';

// ── System Prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are DevMind AI, a personal AI software engineering assistant.
You help developers write, understand, debug, review, and improve code.
You are precise, concise, and technically accurate.
When writing code, always use proper syntax highlighting with fenced code blocks.
When you are unsure, say so rather than guessing.

Repository access rules:
- If the user asks about "the repo", "my project", or repository-specific content
  and NO repository is currently active, call listConnectedRepos first, show the
  user their connected repos, and ask which one they mean. Do NOT guess.
- Once the user names one, call selectRepo, then proceed with their original question
  in the same turn if possible.
- Never fabricate file contents or structure — only report what the tools return.`;

// ── Default model ─────────────────────────────────────────────
const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL ?? 'openai/gpt-4o-mini';

// ── Provider initialization ───────────────────────────────────
function createProvider(): AIProvider {
  const provider = process.env.ACTIVE_AI_PROVIDER ?? 'openrouter';

  switch (provider) {
    case 'openrouter':
      return createOpenRouterProvider({
        apiKey: process.env.OPENROUTER_API_KEY ?? '',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: DEFAULT_MODEL,
      });

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
  /** Active repository ID selected in the UI (may be null) */
  activeRepoId?: string | null;
}

/**
 * NEW: streamChat now returns the stream AND the session object.
 * `session` travels back out so route.ts can check, AFTER streaming ends,
 * whether a tool call (selectRepo/disconnectRepo) changed the active repo
 * mid-turn — and if so, tell the client to update its UI.
 */
export interface StreamChatResult {
  stream: ReadableStream<string>;
  session: ChatSession;
}

/**
 * Truncates conversation messages using a sliding window strategy.
 */
export function truncateConversationContext(
  messages: AIMessage[],
  maxMessages: number = MAX_CONTEXT_MESSAGES
): AIMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }
  console.log(
    `[aiService] Sliding window applied: limiting conversation context from ${messages.length} messages to the most recent ${maxMessages} messages.`
  );
  return messages.slice(-maxMessages);
}

/**
 * Stream a chat response.
 * @returns { stream, session } — stream for SSE, session to detect repo changes.
 */
export async function streamChat(options: StreamChatOptions): Promise<StreamChatResult> {
  const { messages, model = DEFAULT_MODEL, activeRepoId = null } = options;

  const truncatedMessages = truncateConversationContext(messages);

  // Session object is created fresh per request and mutated in-place by
  // selectRepo/disconnectRepo tools during streaming.
  const session: ChatSession = { activeRepoId };

  const stream = await getProvider().stream(truncatedMessages, model, SYSTEM_PROMPT, session);

  return { stream, session };
}

/** Expose the resolved default model (useful for displaying in the UI) */
export { DEFAULT_MODEL, MAX_CONTEXT_MESSAGES };