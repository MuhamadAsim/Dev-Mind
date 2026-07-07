import { StateCreator } from 'zustand';
import { Conversation, Message, MessageRole, ToolCallInfo } from '@/types/chat';
import { generateId } from '@/lib/utils';
import type { RootStore } from '../index';

export interface ChatSlice {
  conversations: Conversation[];
  activeConversationId: string | null;
  loadingMessageIds: Set<string>;

  setConversations: (conversations: Conversation[]) => void;
  upsertConversation: (conversation: Conversation) => void;
  setMessagesLoading: (id: string, loading: boolean) => void;

  createConversation: (firstMessage?: string) => Conversation;
  setActiveConversation: (id: string | null) => void;
  replaceConversationId: (oldId: string, newId: string) => void;

  addMessage: (conversationId: string, role: MessageRole, content: string) => Message;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void;
  appendToMessage: (conversationId: string, messageId: string, chunk: string) => void;

  // NEW — tool-call visibility
  appendToolCall: (conversationId: string, messageId: string, toolCall: ToolCallInfo) => void;
  updateToolCallResult: (
    conversationId: string,
    messageId: string,
    toolCallId: string,
    output: unknown,
    status?: 'done' | 'error'
  ) => void;

  deleteConversation: (id: string) => void;
  pinConversation: (id: string, pinned: boolean) => void;
  renameConversation: (id: string, title: string) => void;
  clearAllConversations: () => void;
}

function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 37) + '…';
}

export const createChatSlice: StateCreator<RootStore, [], [], ChatSlice> = (set, get) => ({
  conversations: [],
  activeConversationId: null,
  loadingMessageIds: new Set<string>(),

  setMessagesLoading: (id, loading) => {
    set((s) => {
      const next = new Set(s.loadingMessageIds);
      if (loading) next.add(id);
      else next.delete(id);
      return { loadingMessageIds: next };
    });
  },

  setConversations: (conversations) =>
    set((state) => ({
      conversations: conversations.map((incoming) => {
        const existing = state.conversations.find((c) => c.id === incoming.id);
        if (existing && incoming.messages.length === 0) {
          return { ...incoming, messages: existing.messages };
        }
        return incoming;
      }),
    })),

  upsertConversation: (conversation) =>
    set((s) => {
      const exists = s.conversations.some((c) => c.id === conversation.id);
      if (exists) return s;
      return {
        conversations: [conversation, ...s.conversations],
        activeConversationId: conversation.id,
      };
    }),

  createConversation: (firstMessage?: string) => {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: `local_${generateId()}`,
      title: firstMessage ? deriveTitle(firstMessage) : 'New conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
      tags: [],
      isPinned: false,
      isSynced: false,
    };
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      activeConversationId: conversation.id,
    }));
    return conversation;
  },

  replaceConversationId: (oldId, newId) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === oldId ? { ...c, id: newId, isSynced: true } : c
      ),
      activeConversationId:
        s.activeConversationId === oldId ? newId : s.activeConversationId,
    }));
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, role, content) => {
    const now = new Date().toISOString();
    const message: Message = {
      id: generateId(),
      role,
      content,
      createdAt: now,
      isStreaming: false,
      status: 'sent',
    };
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message], updatedAt: now }
          : c
      ),
    }));
    return message;
  },

  updateMessage: (conversationId, messageId, patch) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
            ...c,
            messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
          }
          : c
      ),
    }));
  },

  appendToMessage: (conversationId, messageId, chunk) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId ? { ...m, content: m.content + chunk } : m
            ),
          }
          : c
      ),
    }));
  },

  // NEW — appends a fresh tool-call entry (status: 'calling') to the message
  appendToolCall: (conversationId, messageId, toolCall) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId
                ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
                : m
            ),
          }
          : c
      ),
    }));
  },

  // NEW — patches the matching tool-call entry once its result arrives
  updateToolCallResult: (conversationId, messageId, toolCallId, output, status = 'done') => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId
                ? {
                  ...m,
                  toolCalls: (m.toolCalls ?? []).map((tc) =>
                    tc.id === toolCallId ? { ...tc, output, status } : tc
                  ),
                }
                : m
            ),
          }
          : c
      ),
    }));
  },

  deleteConversation: (id) => {
    const { activeConversationId, conversations } = get();
    const remaining = conversations.filter((c) => c.id !== id);
    set({
      conversations: remaining,
      activeConversationId:
        activeConversationId === id ? remaining[0]?.id ?? null : activeConversationId,
    });
  },

  pinConversation: (id, pinned) => {
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, isPinned: pinned } : c)),
    }));
  },

  renameConversation: (id, title) => {
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
  },

  clearAllConversations: () => {
    set({ conversations: [], activeConversationId: null });
  },
});