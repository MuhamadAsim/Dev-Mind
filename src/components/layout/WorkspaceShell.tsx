'use client';

import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { RepositoryPanel } from './RepositoryPanel';
import { TopBar } from './TopBar';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useInitAuth } from '@/store/hooks/useAuth';
//
export function WorkspaceShell() {
  const initAuth = useInitAuth();

  // Mount auth state from localStorage on load
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Register global keyboard shortcuts
  useKeyboardShortcuts();

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

        {/* Center: Chat */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <ChatInterface />
        </main>

        {/* Right: Repo Panel */}
        <RepositoryPanel />
      </div>
    </div>
  );
}
