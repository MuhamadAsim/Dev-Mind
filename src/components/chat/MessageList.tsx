'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageBubble, ThinkingBubble } from './MessageBubble';
import { Message } from '@/types';

interface MessageListProps {
  messages: Message[];
  /** True while waiting on the API response, before the assistant's
   *  streaming message even exists yet. Shows a "Thinking…" bubble. */
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading = false }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages (and when the thinking bubble appears)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content, isLoading]);

  return (
    <div
      className="flex-1 overflow-y-auto scrollbar-hidden"
      role="log"
      aria-live="polite"
      aria-label="Conversation messages"
    >
      <div className="max-w-[var(--chat-max-width)] mx-auto px-4 py-6 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLast={index === messages.length - 1}
            />
          ))}
          {isLoading && <ThinkingBubble key="thinking-bubble" />}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}