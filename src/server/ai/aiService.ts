// ============================================================
// AI Service
//
// Single responsibility: receive a user message + assembled context
// from the Context Orchestration layer, call the LLM, and stream
// the response. No routing. No retrieval. No DB access.
// ============================================================
import type { AIMessage, AIProvider, ChatSession, ChatStreamPart } from './types';
import type { AssembledContext } from '../orchestration/types';
import { createOpenRouterProvider } from './providers/openrouter';

const SYSTEM_PROMPT = `You are DevMind AI, a personal AI software engineering assistant.
You help developers write, understand, debug, review, and improve code.
You are precise, concise, and technically accurate.
When writing code, always use proper syntax highlighting with fenced code blocks.
When you are unsure, say so rather than guessing.

Repository access and context rules:
- If the user asks about "the repo", "my project", or repository-specific content
  and NO repository is currently active, call listConnectedRepos first, show the
  user their connected repos, and ask which one they mean. Do NOT guess.
- Once the user names one, call selectRepo, then proceed with their original question
  in the same turn if possible.
- Prefer semantic repository understanding before broad file exploration or reading large files.
- Use Graphify tools (like query_graph, get_node, get_neighbors, god_nodes, graph_stats, shortest_path) to discover architecture, dependencies, symbols, call relationships, and relevant files first.
- Read source files (using readFile) only after semantic discovery identifies the most relevant code locations.
- Fall back to repository search (searchFiles) or directory browsing (listDirectory) if Graphify tools are not available (e.g. offline) or indicate the repository is not indexed.
- Never fabricate file contents or structure — only report what the tools return.
- Graphify tools only contain semantic metadata; you MUST use readFile to retrieve actual file contents.

Knowledge Base management rules:
- You have tools to manage Knowledge Bases and their documents: listKnowledgeBases, createKnowledgeBase, renameKnowledgeBase, deleteKnowledgeBase, listDocuments, deleteDocument.
- When the user says "list my knowledge bases", call listKnowledgeBases.
- When the user says "create a knowledge base called X", call createKnowledgeBase with the given name.
- When the user says "rename X to Y", call renameKnowledgeBase with the current name and the new name.
- When the user says "delete the X knowledge base", call deleteKnowledgeBase with that name.
- When the user says "show documents in X" or "what's in X" (i.e. wants a list), call listDocuments with the knowledge base name.
- When the user asks about the CONTENT of a specific document (e.g. "read this doc", "what skills are in the CV", "summarize this file"), call getDocumentContent with the document name and knowledge base name. Do this regardless of whether a repository is currently active — Knowledge Base documents are never read via readFile/repository tools, and never require an active repo.- When the user says "delete document Y from X", call deleteDocument with the document name and knowledge base name.
- You can accept names (not just IDs) for both knowledge bases and documents — the tools resolve them internally.
- Always confirm destructive actions (delete) by echoing what you are about to delete before doing it.`;

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
console.log("MAX_CONTEXT_MESSAGES env:", process.env.MAX_CONTEXT_MESSAGES);
console.log("MAX_CONTEXT_MESSAGES parsed:", MAX_CONTEXT_MESSAGES);

export interface StreamChatOptions {
  /** The current user message to send to the LLM. */
  userMessage: string;
  model?: string;
  activeRepoId?: string | null;
  /**
   * Pre-assembled context from the Context Orchestration layer.
   * Contains conversation history (as AIMessage[]) and an optional
   * system context block (repository + knowledge context).
   * When omitted, only the user message is sent with no prior context.
   */
  assembledContext?: AssembledContext;
}

export interface StreamChatResult {
  stream: ReadableStream<ChatStreamPart>;
  session: ChatSession;
}

/**
 * Pure utility — applies the sliding window to a message array.
 * No DB access. Imported by the Conversation Provider.
 */
export function truncateConversationContext(
  messages: AIMessage[],
  maxMessages: number = MAX_CONTEXT_MESSAGES
): AIMessage[] {
  if (messages.length <= maxMessages) return messages;
  console.log(
    `[aiService] Sliding window applied: ${messages.length} → ${maxMessages} messages.`
  );
  return messages.slice(-maxMessages);
}

export async function streamChat(options: StreamChatOptions): Promise<StreamChatResult> {
  const { userMessage, model = DEFAULT_MODEL, activeRepoId = null, assembledContext } = options;

  console.log(`\n=================== AI SERVICE START ===================`);
  console.log(`[aiService DEBUG] userMessage: "${userMessage}"`);
  console.log(`[aiService DEBUG] activeRepoId: ${activeRepoId}`);
  console.log(`[aiService DEBUG] assembledContext details:`);
  console.log(`  - Providers: [${assembledContext?.providers.join(', ') ?? ''}]`);
  console.log(`  - Has systemContextBlock: ${!!assembledContext?.systemContextBlock}`);
  if (assembledContext?.systemContextBlock) {
    console.log(`  - systemContextBlock length: ${assembledContext.systemContextBlock.length}`);
  }

  // Build the messages array: conversation history + current user message.
  // The Conversation Provider has already applied the sliding window.
  const messages: AIMessage[] = [
    ...(assembledContext?.conversationMessages ?? []),
    { role: 'user', content: userMessage },
  ];

  console.log(`[aiService DEBUG] Final messages array (length=${messages.length}):`);
  messages.forEach((m, idx) => {
    console.log(`  - Message #${idx}: role=${m.role}, length=${m.content.length}, preview="${m.content.slice(0, 80).replace(/\r?\n/g, ' ')}..."`);
  });

  // Prepend the system context block (repository + knowledge context) to the
  // system prompt when the orchestration layer has retrieved relevant context.
  const instructions =
    assembledContext?.systemContextBlock
      ? [
        'The following context was automatically retrieved to help you answer the request.',
        'Use it when relevant; disregard it if it does not apply to the question.',
        '',
        assembledContext.systemContextBlock,
        '',
        '---',
        '',
        SYSTEM_PROMPT,
      ].join('\r\n')
      : SYSTEM_PROMPT;

  console.log(`[aiService DEBUG] Final instructions (system prompt) (length=${instructions.length}):`);
  console.log(`\n---------------- INSTRUCTIONS START ----------------`);
  console.log(instructions);
  console.log(`----------------- INSTRUCTIONS END -----------------\n`);

  const session: ChatSession = { activeRepoId };
  console.log(`[aiService DEBUG] Calling getProvider().stream()...`);
  const stream = await getProvider().stream(messages, model, instructions, session);
  console.log(`=================== AI SERVICE END ===================\n`);
  return { stream, session };
}

export { DEFAULT_MODEL, MAX_CONTEXT_MESSAGES };