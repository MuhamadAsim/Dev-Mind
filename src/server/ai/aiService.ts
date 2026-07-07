// ============================================================
// AI Service
// ============================================================
import type { AIMessage, AIProvider, ChatSession, ChatStreamPart } from './types';
import { createOpenRouterProvider } from './providers/openrouter';

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

const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL ?? 'openai/gpt-4o-mini';

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

let _provider: AIProvider | null = null;
function getProvider(): AIProvider {
  if (!_provider) _provider = createProvider();
  return _provider;
}

const MAX_CONTEXT_MESSAGES = (() => {
  const envVal = process.env.MAX_CONTEXT_MESSAGES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 20;
})();

export interface StreamChatOptions {
  messages: AIMessage[];
  model?: string;
  activeRepoId?: string | null;
}

export interface StreamChatResult {
  stream: ReadableStream<ChatStreamPart>; // CHANGED: was ReadableStream<string>
  session: ChatSession;
}

export function truncateConversationContext(
  messages: AIMessage[],
  maxMessages: number = MAX_CONTEXT_MESSAGES
): AIMessage[] {
  if (messages.length <= maxMessages) return messages;
  console.log(
    `[aiService] Sliding window applied: limiting conversation context from ${messages.length} messages to the most recent ${maxMessages} messages.`
  );
  return messages.slice(-maxMessages);
}

export async function streamChat(options: StreamChatOptions): Promise<StreamChatResult> {
  const { messages, model = DEFAULT_MODEL, activeRepoId = null } = options;
  const truncatedMessages = truncateConversationContext(messages);
  const session: ChatSession = { activeRepoId };
  const stream = await getProvider().stream(truncatedMessages, model, SYSTEM_PROMPT, session);
  return { stream, session };
}

export { DEFAULT_MODEL, MAX_CONTEXT_MESSAGES };