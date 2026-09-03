// ============================================================
// AI Service
//
// Single responsibility: receive a user message + assembled context
// from the Context Orchestration layer, call the LLM, and stream
// the response. No routing. No retrieval. No DB access.
// ============================================================
import type { AIMessage, AIProvider, ChatSession, ChatStreamPart } from './types';
import type { AssembledContext } from '../orchestration/types';
import type { ResponseMode } from '../voice/types';
import { createOpenRouterProvider } from './providers/openrouter';

const SYSTEM_PROMPT = `You are DevMind AI, a personal AI software engineering assistant.
You help developers write, understand, debug, review, and improve code.
You are precise, concise, and technically accurate.
When writing code, always use proper syntax highlighting with fenced code blocks.
When you are unsure, say so rather than guessing.

Language Guidelines:
- Urdu (اردو) is EXCLUSIVELY used when Voice Delivery Mode is active (for voice synthesis) or when the user specifically writes their message in Urdu script.
- For ALL standard TEXT responses, you MUST ALWAYS respond in clear, professional ENGLISH.
- NEVER reply in Urdu for text responses to questions asked in English, even if previous messages in the conversation were in Urdu.

Voice and Audio Output Rules:
- DevMind AI has an integrated text-to-speech voice pipeline (powered by Uplift AI).
- NEVER say "I cannot provide voice output", "I am a text-based AI", "I cannot speak", or make disclaimers about voice or audio capabilities. Audio synthesis is handled automatically by the system.

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
  /** Response delivery mode ('text' | 'voice' | 'both') */
  responseMode?: ResponseMode;
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
  const {
    userMessage,
    model = DEFAULT_MODEL,
    activeRepoId = null,
    assembledContext,
    responseMode = 'text',
  } = options;

  console.log(`\n=================== AI SERVICE START ===================`);
  console.log(`[aiService DEBUG] userMessage: "${userMessage}"`);
  console.log(`[aiService DEBUG] activeRepoId: ${activeRepoId}`);
  console.log(`[aiService DEBUG] responseMode: ${responseMode}`);
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

  // Instruction blocks for voice delivery vs text delivery turns
  const isVoiceMode = responseMode === 'voice' || responseMode === 'both';

  const voiceTopBanner = isVoiceMode
    ? [
        '================================================================================',
        '🚨 MANDATORY VOICE DELIVERY DIRECTIVE — YOU MUST RESPOND IN URDU (اردو) 🚨',
        '================================================================================',
        '1. LANGUAGE REQUIREMENT: Your response will be synthesized directly into spoken audio via the Uplift AI Urdu voice synthesizer. Therefore, you MUST write your entire response in fluent, natural Urdu script (اردو رسم الخط).',
        '2. ABSOLUTELY NO ENGLISH EXPLANATIONS: Do NOT output English sentences, paragraphs, or bullet points. Even if the user asked their question in English, and even if retrieved documents, knowledge base data, or tool outputs are in English, translate the facts and explain them directly in natural Urdu (اردو).',
        '3. ZERO DISCLAIMERS: You are speaking directly to the user through the Uplift voice synthesizer. NEVER say "I cannot provide voice output", "I am a text model", "I cannot speak", or "I will provide text instead". Start answering immediately in conversational Urdu.',
        '4. SPOKEN CONVERSATIONAL STYLE: Speak conversationally and directly as if talking to the user. Avoid markdown tables, bulleted lists, code blocks, or raw URLs that sound awkward when read aloud. Use proper Urdu punctuation (۔ and ؟).',
        '5. IGNORE PRIOR TURN LANGUAGE: Even if previous assistant turns were in English, you MUST follow this directive for this turn and speak in Urdu only.',
        '================================================================================',
        '',
      ].join('\r\n')
    : '';

  const voiceBottomReminder = isVoiceMode
    ? [
        '',
        '---',
        '[CRITICAL INSTRUCTION - VOICE DELIVERY MODE ACTIVE]',
        'Remember: Voice mode is active for Uplift AI synthesis. Deliver your COMPLETE answer in fluent, conversational Urdu script (اردو). ZERO disclaimers. NO English explanations. NO markdown tables or bulleted lists.',
        '---',
      ].join('\r\n')
    : '';

  const textTopBanner = !isVoiceMode
    ? [
        '================================================================================',
        '💬 MANDATORY TEXT DELIVERY DIRECTIVE — YOU MUST RESPOND IN ENGLISH 💬',
        '================================================================================',
        '1. LANGUAGE REQUIREMENT: This turn is delivered as standard TEXT (not voice). You MUST write your complete response in clear, concise ENGLISH.',
        '2. ABSOLUTELY NO URDU IN TEXT MODE: Do NOT reply in Urdu for this turn. Urdu is EXCLUSIVELY reserved for voice output turns. Even if previous assistant turns in this conversation were in Urdu (from voice notes), you MUST switch back and respond in ENGLISH.',
        '3. EXCEPTION: Only reply in Urdu if the user explicitly typed their current message in Urdu script (e.g. اردو رسم الخط میں). If the prompt was written in English or Latin script (e.g. "And education", "Now tell me the address"), your reply MUST be in ENGLISH.',
        '================================================================================',
        '',
      ].join('\r\n')
    : '';

  const textBottomReminder = !isVoiceMode
    ? [
        '',
        '---',
        '[CRITICAL INSTRUCTION - TEXT RESPONSE MODE ACTIVE]',
        'Remember: This turn is delivered as TEXT. Write your response in clear ENGLISH. Do NOT reply in Urdu unless the user wrote their prompt in Urdu script.',
        '---',
      ].join('\r\n')
    : '';

  // Prepend the system context block (repository + knowledge context) to the
  // system prompt when the orchestration layer has retrieved relevant context.
  const baseInstructions =
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

  const instructions = isVoiceMode
    ? `${voiceTopBanner}${baseInstructions}${voiceBottomReminder}`
    : `${textTopBanner}${baseInstructions}${textBottomReminder}`;

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