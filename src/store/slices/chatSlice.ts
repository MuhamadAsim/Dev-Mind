// ============================================================
// Chat Slice — conversations, messages, active thread
// Phase 2 additions:
//   - setConversations()       bulk-load from API on mount
//   - appendToMessage()        append streaming chunk to a message
//   - Conversations no longer persist to localStorage (MongoDB is source of truth)
// ============================================================
import { StateCreator } from 'zustand';
import { Conversation, Message, MessageRole } from '@/types/chat';
import { generateId } from '@/lib/utils';
import type { RootStore } from '../index';

export interface ChatSlice {
  // State
  conversations: Conversation[];
  activeConversationId: string | null;
  /** Conversation ids currently fetching their messages (lazy-load in Sidebar) */
  loadingMessageIds: Set<string>;

  // Actions
  /** Bulk-replace the conversation list (called after API fetch on mount) */
  setConversations: (conversations: Conversation[]) => void;
  /** Insert a conversation if it doesn't already exist (used for server-created convs) */
  upsertConversation: (conversation: Conversation) => void;
  /** Mark a conversation's messages as loading/not-loading, for UI spinners */
  setMessagesLoading: (id: string, loading: boolean) => void;

  createConversation: (firstMessage?: string) => Conversation;
  setActiveConversation: (id: string | null) => void;
  replaceConversationId: (oldId: string, newId: string) => void;


  addMessage: (conversationId: string, role: MessageRole, content: string) => Message;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void;
  /** Append a streaming text chunk to an existing message's content */
  appendToMessage: (conversationId: string, messageId: string, chunk: string) => void;
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

  // ── Phase 2: bulk-load from API ───────────────────────────
  // NOTE: this is reused for two different call sites:
  //  1) WorkspaceShell's initial bulk list load — incoming conversations
  //     never include messages (list endpoint doesn't return them), so we
  //     must preserve whatever's already loaded in memory.
  //  2) Sidebar's lazy per-conversation message load — incoming DOES
  //     include real messages for the selected conversation, and those
  //     must win, not be discarded in favor of stale local state.
  // Only fall back to the existing in-memory messages when incoming has
  // none at all; otherwise trust what was just passed in.
  setConversations: (conversations) =>
    set((state) => ({
      conversations: conversations.map((incoming) => {
        const existing = state.conversations.find(
          (c) => c.id === incoming.id
        );

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
      // Prefixed so a local draft id can NEVER collide with a real Mongo
      // ObjectId once it gets replaced below.
      id: `local_${generateId()}`,
      title: firstMessage ? deriveTitle(firstMessage) : 'New conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
      tags: [],
      isPinned: false,
      isSynced: false, // not saved to Mongo yet
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
            messages: c.messages.map((m) =>
              m.id === messageId ? { ...m, ...patch } : m
            ),
          }
          : c
      ),
    }));
  },

  // ── Phase 2: streaming chunk append ──────────────────────
  appendToMessage: (conversationId, messageId, chunk) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId
                ? { ...m, content: m.content + chunk }
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