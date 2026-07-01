'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { EmptyState } from './EmptyState';
import {
  useActiveConversation,
  useActiveConversationId,
  useCreateConversation,
  useAddMessage,
} from '@/store/hooks/useChat';
import { generateId } from '@/lib/utils';
import { Message } from '@/types';

// ── Mock AI responses ─────────────────────────────────────────
const MOCK_RESPONSES = [
  "Great question! Let me analyze that for you.\n\nBased on what you've described, I'd recommend breaking this down into smaller components. First, let's think about the data flow and then work our way up to the UI layer.",
  "I can help with that! Here's my thinking:\n\n1. Start by defining your TypeScript interfaces\n2. Build the data layer first\n3. Then wire up your UI components\n\nThis approach keeps concerns separated and makes testing easier.",
  "That's a classic architectural challenge. The key insight here is to think about **single responsibility** — each module should do one thing well.\n\nFor your use case, I'd consider using a service layer to abstract the API calls from your React components.",
  "Interesting approach! A few things to consider:\n\n- Type safety is your friend here — don't use `any`\n- Consider error boundaries for resilience\n- Memoize expensive computations with `useMemo`\n\nWant me to elaborate on any of these points?",
  "Here's a pattern I'd recommend for this scenario:\n\n```typescript\n// Clean, composable, and testable\nconst useFeature = () => {\n  const [state, setState] = useState(initialState);\n  // ... your logic here\n  return { state, actions };\n};\n```\n\nThis keeps your components lean and logic testable.",
];

function getMockResponse(): string {
  return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
}

export function ChatInterface() {
  const activeConversationId = useActiveConversationId();
  const activeConversation = useActiveConversation();
  const createConversation = useCreateConversation();
  const addMessage = useAddMessage();
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(
    async (content: string) => {
      // Create conversation if none active
      let convId = activeConversationId;
      if (!convId) {
        const newConv = createConversation(content);
        convId = newConv.id;
      }

      // Add user message
      addMessage(convId, 'user', content);

      // Simulate AI response with delay
      setIsLoading(true);
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
      addMessage(convId, 'assistant', getMockResponse());
      setIsLoading(false);
    },
    [activeConversationId, createConversation, addMessage]
  );

  const handleSelectPrompt = useCallback(
    (prompt: string) => handleSend(prompt),
    [handleSend]
  );

  const messages = activeConversation?.messages ?? [];
  const hasMessages = messages.length > 0;

  // Build messages list including the loading indicator
  const displayMessages: Message[] = isLoading
    ? [
        ...messages,
        {
          id: 'streaming-indicator',
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
          isStreaming: true,
        },
      ]
    : messages;

  return (
    <div
      id="chat-interface"
      className="flex flex-col h-full"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Messages or empty state */}
      <AnimatePresence mode="wait">
        {hasMessages ? (
          <motion.div
            key="messages"
            className="flex-1 min-h-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <MessageList messages={displayMessages} />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="flex-1 min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState onSelectPrompt={handleSelectPrompt} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
