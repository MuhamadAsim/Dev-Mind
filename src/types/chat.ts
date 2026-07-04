// ============================================================
// Chat & Conversation Types
// Designed to support streaming, multi-model, and agent modes later
// ============================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'error';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string; // ISO date string
  /** true while streaming — set to false when complete */
  isStreaming?: boolean;
  status?: MessageStatus;
  /** Extensible for future tool calls, citations, etc. */
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  model?: string;
  tags?: string[];
  isPinned?: boolean;
  /** True once this conversation exists in the DB.
   *  False = local-only draft (e.g. "New conversation" not yet sent). */
  isSynced?: boolean;
}

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
}
