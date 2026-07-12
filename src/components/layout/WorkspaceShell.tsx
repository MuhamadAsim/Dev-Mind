'use client';

import { useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { RepositoryPanel } from './RepositoryPanel';
import { TopBar } from './TopBar';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { KnowledgePanel } from '@/components/knowledge/KnowledgePanel';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useInitAuth } from '@/store/hooks/useAuth';
import { useSetConversations } from '@/store/hooks/useChat';
import { useFetchConnectedRepos } from '@/store/hooks/useRepo';
import { useActiveView } from '@/store/hooks/useUI';
import { Conversation } from '@/types';

export function WorkspaceShell() {
  const initAuth = useInitAuth();
  const setConversations = useSetConversations();
  const fetchConnectedRepos = useFetchConnectedRepos();

  // Mount auth state from localStorage on load
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Load conversations from MongoDB on mount
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) return;
      const data = await res.json() as {
        conversations: Array<{
          id: string; title: string; aiModel: string; isPinned: boolean;
          createdAt: string; updatedAt: string; metadata: Record<string, unknown>;
        }>
      };
      console.log('[LOAD CONVERSATIONS]', data);   // ← add this

      const conversations: Conversation[] = data.conversations.map((c) => ({
        id: c.id,
        title: c.title,
        messages: [], // messages loaded lazily on conversation select
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        model: c.aiModel,
        tags: [],
        isPinned: c.isPinned ?? false,
        isSynced: true, // loaded from the DB, so it's a real conversation
      }));
      setConversations(conversations);
    } catch (err) {
      console.error('[WorkspaceShell] Failed to load conversations:', err);
    }
  }, [setConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load connected repositories from MongoDB on mount
  useEffect(() => {
    fetchConnectedRepos();
  }, [fetchConnectedRepos]);

  // Register global keyboard shortcuts
  useKeyboardShortcuts();

  const activeView = useActiveView();

  return (
    <div
      id="workspace-shell"
      className="flex flex-col h-dvh overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Top bar */}
      <TopBar />

      {/* Three-panel body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Sidebar */}
        <Sidebar />

        {/* Center: Chat or Knowledge */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {activeView === 'knowledge' ? <KnowledgePanel /> : <ChatInterface />}
        </main>

        {/* Right: Repo Panel */}
        <RepositoryPanel />
      </div>
    </div>
  );
}