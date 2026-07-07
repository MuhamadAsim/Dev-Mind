// Components must import from here — not from useStore directly
import { useStore } from '../index';
import { useShallow } from 'zustand/react/shallow';

export const useConversations = () => useStore((s) => s.conversations);
export const useActiveConversationId = () => useStore((s) => s.activeConversationId);
export const useAppendToolCall = () => useStore((s) => s.appendToolCall);
export const useUpdateToolCallResult = () => useStore((s) => s.updateToolCallResult);
export const useActiveConversation = () =>
  useStore(
    useShallow((s) =>
      s.conversations.find((c) => c.id === s.activeConversationId) ?? null
    )
  );
export const useSetConversations = () => useStore((s) => s.setConversations);
export const useUpsertConversation = () => useStore((s) => s.upsertConversation);
export const useReplaceConversationId = () => useStore((s) => s.replaceConversationId);
export const useCreateConversation = () => useStore((s) => s.createConversation);
export const useSetActiveConversation = () => useStore((s) => s.setActiveConversation);
export const useAddMessage = () => useStore((s) => s.addMessage);
export const useUpdateMessage = () => useStore((s) => s.updateMessage);
export const useAppendToMessage = () => useStore((s) => s.appendToMessage);
export const useDeleteConversation = () => useStore((s) => s.deleteConversation);
export const usePinConversation = () => useStore((s) => s.pinConversation);
export const useRenameConversation = () => useStore((s) => s.renameConversation);
export const useClearAllConversations = () => useStore((s) => s.clearAllConversations);

// ── Message-loading spinner state (per conversation) ─────────
export const useLoadingMessageIds = () => useStore((s) => s.loadingMessageIds);
export const useSetMessagesLoading = () => useStore((s) => s.setMessagesLoading);