// Components must import from here — not from useStore directly
import { useStore } from '../index';
import { useShallow } from 'zustand/react/shallow';

export const useConversations = () => useStore((s) => s.conversations);
export const useActiveConversationId = () => useStore((s) => s.activeConversationId);
export const useActiveConversation = () =>
  useStore(
    useShallow((s) =>
      s.conversations.find((c) => c.id === s.activeConversationId) ?? null
    )
  );
export const useCreateConversation = () => useStore((s) => s.createConversation);
export const useSetActiveConversation = () => useStore((s) => s.setActiveConversation);
export const useAddMessage = () => useStore((s) => s.addMessage);
export const useUpdateMessage = () => useStore((s) => s.updateMessage);
export const useDeleteConversation = () => useStore((s) => s.deleteConversation);
export const usePinConversation = () => useStore((s) => s.pinConversation);
export const useRenameConversation = () => useStore((s) => s.renameConversation);
export const useClearAllConversations = () => useStore((s) => s.clearAllConversations);
