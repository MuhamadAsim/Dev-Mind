export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'error';

// NEW: one tool call, tracked from "calling" through "done"/"error" so the
// UI can render a live indicator, not just a static log after the fact.
export interface ToolCallInfo {
  id: string; // toolCallId from the AI SDK
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  status: 'calling' | 'done' | 'error';
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  isStreaming?: boolean;
  status?: MessageStatus;
  metadata?: Record<string, unknown>;
  toolCalls?: ToolCallInfo[]; // NEW
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
  isSynced?: boolean;
}

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
}