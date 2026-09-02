import type { ChatStreamPart, ChatSession } from '../ai/types';
import type { MessageDTO } from '../db/messageService';
import type { ResponseMode } from '../voice/types';

// Open union: known client types get autocomplete/typo-safety, but the type
// still accepts any string so a new client (Telegram, Slack, CLI, voice)
// never requires editing this file to compile.
export type ClientType = 'web' | 'whatsapp' | (string & {});

export interface ChatSessionContext {
  clientType: ClientType;
  conversationId: string | null;      // null = orchestrator creates a new one
  activeRepositoryId: string | null;  // null = no repo context
  model?: string;                     // falls back to DEFAULT_AI_MODEL if omitted
  metadata?: Record<string, unknown>; // client-specific extras (e.g. phoneNumber for WhatsApp)
}

export interface StartChatTurnResult {
  conversationId: string;
  assistantMessageId: string;
  stream: ReadableStream<ChatStreamPart>;
  finalize: (fullText: string) => Promise<MessageDTO>;
  session: ChatSession;
  responseMode: ResponseMode;
}

