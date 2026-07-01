// ============================================================
// Chat Slice — conversations, messages, active thread
// ============================================================
import { StateCreator } from 'zustand';
import { Conversation, Message, MessageRole } from '@/types/chat';
import { generateId } from '@/lib/utils';
import type { RootStore } from '../index';

export interface ChatSlice {
  // State
  conversations: Conversation[];
  activeConversationId: string | null;

  // Actions
  createConversation: (firstMessage?: string) => Conversation;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, role: MessageRole, content: string) => Message;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void;
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

  createConversation: (firstMessage?: string) => {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: generateId(),
      title: firstMessage ? deriveTitle(firstMessage) : 'New conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
      model: 'devmind-mock-v1',
      tags: [],
      isPinned: false,
    };
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      activeConversationId: conversation.id,
    }));
    return conversation;
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
            messages: c.messages.map((m) =>
              m.id === messageId ? { ...m, ...patch } : m
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
        activeConversationId === id
          ? remaining[0]?.id ?? null
          : activeConversationId,
    });
  },

  pinConversation: (id, pinned) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, isPinned: pinned } : c
      ),
    }));
  },

  renameConversation: (id, title) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    }));
  },

  clearAllConversations: () => {
    set({ conversations: [], activeConversationId: null });
  },
});
