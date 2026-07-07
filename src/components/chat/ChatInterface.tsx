'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { EmptyState } from './EmptyState';
import {
  useActiveConversation,
  useActiveConversationId,
  useAddMessage,
  useAppendToMessage,
  useUpdateMessage,
  useSetConversations,
  useCreateConversation,
  useReplaceConversationId,
  useLoadingMessageIds,
} from '@/store/hooks/useChat';
import {
  useActiveRepoId,
  useSetActiveRepoId,
  useFetchConnectedRepos,
} from '@/store/hooks/useRepo';
import { Conversation } from '@/types';

// ── SSE event shapes from POST /api/chat/stream ───────────────
type StreamMeta = { type: 'meta'; conversationId: string; assistantMessageId: string };
type StreamChunk = { type: 'chunk'; text: string };
type StreamDone = { type: 'done' };
type StreamError = { type: 'error'; message: string };
// Server tells us the AI activated/deactivated a repo mid-turn
// (emitted by route.ts whenever session.activeRepoId changes from the
// value the client sent in — see selectRepo/disconnectRepo tools).
type StreamRepoContext = { type: 'repoContext'; activeRepoId: string | null };
type StreamEvent = StreamMeta | StreamChunk | StreamDone | StreamError | StreamRepoContext;

// ── Sidebar reload helper ─────────────────────────────────────
async function fetchConversationList(): Promise<Conversation[]> {
  const res = await fetch('/api/conversations');
  if (!res.ok) return [];
  const data = await res.json() as {
    conversations: Array<{
      id: string;
      title: string;
      aiModel: string;
      isPinned: boolean;
      createdAt: string;
      updatedAt: string;
      metadata: Record<string, unknown>;
    }>;
  };
  return data.conversations.map((c) => ({
    id: c.id,
    title: c.title,
    messages: [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    model: c.aiModel,
    tags: [],
    isPinned: c.isPinned ?? false,
    isSynced: true, // came from the DB, so it's real
  }));
}

// ── Component ─────────────────────────────────────────────────

export function ChatInterface() {
  const activeConversationId = useActiveConversationId();
  const activeConversation = useActiveConversation();
  const activeRepoId = useActiveRepoId();
  const loadingMessageIds = useLoadingMessageIds();
  const addMessage = useAddMessage();
  const appendToMessage = useAppendToMessage();
  const updateMessage = useUpdateMessage();
  const setConversations = useSetConversations();
  const createConversation = useCreateConversation();
  const replaceConversationId = useReplaceConversationId();

  // NEW: needed to sync Zustand when the AI switches/clears the active
  // repo mid-turn (selectRepo / disconnectRepo tools). Without these two,
  // the server-side repoContext event has nowhere to land on the client.
  const setActiveRepoId = useSetActiveRepoId();
  const refreshConnectedRepos = useFetchConnectedRepos();

  const [isLoading, setIsLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const handleSend = useCallback(
    async (content: string) => {
      setStreamError(null);

      // ── Step 1: figure out which conversation this message belongs to.
      // "New" means: no active conversation yet, OR the active one is a
      // local draft that Mongo doesn't know about yet.
      const isNewConversation = !activeConversation || !activeConversation.isSynced;

      let convId = activeConversationId;
      if (!convId) {
        const created = createConversation(content);
        convId = created.id;
      }

      // ── Step 2: optimistic render — BEFORE the network call.
      // This is what kills the 2s delay: the bubble shows instantly.
      const userMsg = addMessage(convId, 'user', content);
      setIsLoading(true);

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Only pass an id the server already recognizes.
            // For a fresh local draft, tell the server to create a new one.
            conversationId: isNewConversation ? null : convId,
            message: content,
            activeRepoId,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server responded with ${response.status}`);
        }

        // NOTE: isLoading stays true here — do NOT clear it yet.
        // Clearing it now (right after headers arrive) leaves a gap where
        // isLoading is false but the assistant message doesn't exist yet
        // (it's only added once the 'meta' SSE event is parsed below).
        // That gap is where the "thinking" bubble was invisibly vanishing.

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let localMsgId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice('data: '.length).trim();
            if (!raw) continue;

            let event: StreamEvent;
            try { event = JSON.parse(raw) as StreamEvent; }
            catch { continue; }

            if (event.type === 'meta') {
              // Server confirmed the real DB id. If we were on a local
              // draft, rename it in place — do NOT create a new entry.
              if (isNewConversation && convId !== event.conversationId) {
                replaceConversationId(convId, event.conversationId);
              }
              convId = event.conversationId;

              const added = addMessage(convId, 'assistant', '');
              localMsgId = added.id;
              updateMessage(convId, added.id, { isStreaming: true, status: 'sending' });
              // Only now does the real streaming bubble exist — safe to
              // drop the thinking indicator without a visual gap.
              setIsLoading(false);

            } else if (event.type === 'chunk' && localMsgId) {
              appendToMessage(convId, localMsgId, event.text);

            } else if (event.type === 'done' && localMsgId) {
              updateMessage(convId, localMsgId, { isStreaming: false, status: 'sent' });
              fetchConversationList().then(setConversations).catch(console.error);

            } else if (event.type === 'error') {
              setStreamError(event.message);
              if (localMsgId) {
                updateMessage(convId, localMsgId, {
                  isStreaming: false,
                  status: 'error',
                  content: '⚠ Something went wrong. Please try again.',
                });
              }

            } else if (event.type === 'repoContext') {
              // NEW: the AI called selectRepo/disconnectRepo mid-turn.
              // Only act if it's actually different from what we already
              // have, to avoid redundant fetches on every message.
              if (event.activeRepoId !== activeRepoId) {
                // Refresh the connected-repos list FIRST — covers the case
                // where disconnectRepo ran and removed an entry from Mongo
                // that our local `connectedRepos` array doesn't know about
                // yet. Only after that do we activate the new repo, so
                // setActiveRepoId() can actually find it in the fresh list.
                refreshConnectedRepos().then(() => {
                  setActiveRepoId(event.activeRepoId);
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('[ChatInterface] Stream error:', err);
        setStreamError('Failed to reach the AI service. Check your API key and try again.');
        updateMessage(convId, userMsg.id, { status: 'error' });
        setIsLoading(false);
      }
    },
    [
      activeConversationId,
      activeConversation,
      activeRepoId,
      addMessage,
      appendToMessage,
      updateMessage,
      setConversations,
      createConversation,
      replaceConversationId,
      setActiveRepoId,        // NEW
      refreshConnectedRepos,  // NEW
    ]
  );

  const handleSelectPrompt = useCallback(
    (prompt: string) => handleSend(prompt),
    [handleSend]
  );

  const messages = activeConversation?.messages ?? [];
  const hasMessages = messages.length > 0;
  // True while Sidebar is lazy-loading this conversation's messages —
  // distinct from "genuinely has zero messages," so we don't flash the
  // landing page before the real content arrives.
  const isSwitchingConversation =
    !!activeConversationId && loadingMessageIds.has(activeConversationId);

  return (
    <div
      id="chat-interface"
      className="flex flex-col h-full"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <AnimatePresence>
        {streamError && (
          <motion.div
            key="error-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-4 mt-3 px-4 py-2.5 rounded-xl text-sm cursor-pointer"
            onClick={() => setStreamError(null)}
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
            }}
          >
            ⚠ {streamError}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isSwitchingConversation ? (
          <motion.div
            key="switching"
            className="flex-1 min-h-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="h-5 w-5 rounded-full border-2 animate-spin"
              style={{
                borderColor: 'var(--color-border)',
                borderTopColor: 'var(--color-accent)',
              }}
            />
          </motion.div>
        ) : hasMessages ? (
          <motion.div
            key="messages"
            className="flex-1 min-h-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <MessageList messages={messages} isLoading={isLoading} />
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

      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}