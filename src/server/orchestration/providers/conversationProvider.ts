// ============================================================
// Conversation Provider
//
// Retrieves conversation history for the current session.
// Applies the global sliding-window limit via truncateConversationContext.
// Returns structured ContextEntry[] with type 'message'.
//
// Stateless — no shared state with other providers.
// ============================================================
import type { RouterInput, ProviderResult, IContextProvider, ContextEntry } from '../types';
import { getMessages } from '../../db/messageService';
import { truncateConversationContext } from '../../ai/aiService';
import type { AIMessage } from '../../ai/types';

export class ConversationProvider implements IContextProvider {
  readonly name = 'conversation' as const;

  async provide(input: RouterInput): Promise<ProviderResult | null> {
    const { conversationId } = input;

    if (!conversationId) return null;

    try {
      const allMessages = await getMessages(conversationId);

      // The current user message was saved to DB immediately before this provider
      // runs (in chatOrchestrator step 2). Exclude the last entry to avoid the
      // AI Service receiving a duplicate of the current turn.
      const historyMessages = allMessages.slice(0, -1);

      if (historyMessages.length === 0) return null;

      // Convert to AIMessage format for sliding-window truncation
      const aiMessages: AIMessage[] = historyMessages.map(m => ({
        role: m.role as AIMessage['role'],
        content: m.content,
      }));

      // Apply the global MAX_CONTEXT_MESSAGES sliding window
      const windowed = truncateConversationContext(aiMessages);

      if (windowed.length === 0) return null;

      const entries: ContextEntry[] = windowed.map((m, i) => ({
        type: 'message',
        // Store the raw content — Context Builder accesses metadata.role
        // to reconstruct proper AIMessage objects (not formatted text)
        content: m.content,
        metadata: {
          role: m.role,
          originalIndex: i,
        },
      }));

      console.log(`[conversationProvider] ${entries.length} messages (of ${historyMessages.length} total, after sliding window)`);

      return {
        provider: 'conversation',
        entries,
        metadata: {
          totalHistory: historyMessages.length,
          windowedCount: windowed.length,
        },
      };
    } catch (err: any) {
      console.error('[conversationProvider] Failed to retrieve conversation history:', err?.message ?? err);
      return null;
    }
  }
}
