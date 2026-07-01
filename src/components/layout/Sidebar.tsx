'use client';

import { forwardRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  MessageSquarePlus,
  Search,
  Pin,
  Trash2,
  ChevronLeft,
  Bot,
  MoreHorizontal,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Logo } from '@/components/shared/Logo';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useIsSidebarOpen } from '@/store/hooks/useUI';
import {
  useConversations,
  useActiveConversationId,
  useSetActiveConversation,
  useCreateConversation,
  useDeleteConversation,
  usePinConversation,
} from '@/store/hooks/useChat';
import { useToggleSidebar } from '@/store/hooks/useUI';
import { formatDate, truncate } from '@/lib/utils';
import { Conversation } from '@/types';

const SIDEBAR_W = 260;

// Hardcoded palettes — bypasses CSS variables entirely, switched manually by resolvedTheme
const PALETTES = {
  dark: {
    bgSurface: '#161b27',
    bgElevated: '#1e2433',
    bgOverlay: '#262d3f',
    bgHover: 'rgba(255, 255, 255, 0.06)',
    bgActive: 'rgba(99, 102, 241, 0.15)',
    border: 'rgba(255, 255, 255, 0.10)',
    borderHover: 'rgba(255, 255, 255, 0.18)',
    accent: '#6366f1',
    accentBorder: 'rgba(99, 102, 241, 0.40)',
    accentMuted: 'rgba(99, 102, 241, 0.15)',
    textPrimary: '#ffffff',
    textMuted: '#94a3b8',
    error: '#ef4444',
  },
  light: {
    bgSurface: '#ffffff',
    bgElevated: '#f8fafc',
    bgOverlay: '#e2e8f0',
    bgHover: 'rgba(0, 0, 0, 0.05)',
    bgActive: 'rgba(99, 102, 241, 0.10)',
    border: 'rgba(0, 0, 0, 0.10)',
    borderHover: 'rgba(0, 0, 0, 0.20)',
    accent: '#6366f1',
    accentBorder: 'rgba(99, 102, 241, 0.40)',
    accentMuted: 'rgba(99, 102, 241, 0.15)',
    textPrimary: '#000000',
    textMuted: '#334155',
    error: '#ef4444',
  },
};

export function Sidebar() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const COLORS = mounted && resolvedTheme === 'light' ? PALETTES.light : PALETTES.dark;

  const isOpen = useIsSidebarOpen();
  const toggleSidebar = useToggleSidebar();
  const conversations = useConversations();
  const activeId = useActiveConversationId();
  const setActive = useSetActiveConversation();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const pinConversation = usePinConversation();

  const pinned = conversations.filter((c) => c.isPinned);
  const recent = conversations.filter((c) => !c.isPinned);

  const handleNewChat = () => {
    createConversation();
  };

  return (
    <>
      {/* Sidebar panel */}
      <motion.aside
        id="sidebar"
        initial={false}
        animate={{ width: isOpen ? SIDEBAR_W : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="relative flex flex-col h-full overflow-hidden shrink-0"
        style={{
          background: COLORS.bgSurface,
          borderRight: `1px solid ${COLORS.border}`,
        }}
        aria-label="Conversation sidebar"
      >
        <div style={{ width: SIDEBAR_W }} className="flex flex-col h-full">
          {/* Top: Logo + toggle */}
          <div
            className="flex items-center justify-between px-3 py-3 shrink-0"
            style={{ borderBottom: `1px solid ${COLORS.border}` }}
          >
            <Logo size="sm" />
            <Tooltip>
              <TooltipTrigger
                render={
                  <motion.button
                    type="button"
                    onClick={toggleSidebar}
                    className="flex items-center justify-center h-7 w-7 rounded-lg cursor-pointer"
                    style={{
                      color: COLORS.textMuted,
                      border: '1px solid transparent',
                    }}
                    whileHover={{
                      background: COLORS.bgHover,
                      color: COLORS.textPrimary,
                      borderColor: COLORS.border,
                    }}
                    whileTap={{ scale: 0.92 }}
                    aria-label="Collapse sidebar"
                  >
                    <ChevronLeft size={14} />
                  </motion.button>
                }
              />
              <TooltipContent side="right">Collapse (⌘B)</TooltipContent>
            </Tooltip>
          </div>

          {/* New chat + search */}
          <div className="px-2 py-2 space-y-1 shrink-0">
            <motion.button
              id="new-chat-btn"
              type="button"
              onClick={handleNewChat}
              className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
                border: `1px solid ${COLORS.accentBorder}`,
                color: COLORS.accent,
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <MessageSquarePlus size={14} />
              New conversation
            </motion.button>

            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: COLORS.bgElevated,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <Search size={12} style={{ color: COLORS.textMuted }} />
              <input
                type="text"
                placeholder="Search conversations…"
                className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-60"
                style={{
                  color: COLORS.textPrimary,
                }}
                aria-label="Search conversations"
              />
            </div>
          </div>

          {/* Conversation list */}
          <ScrollArea className="flex-1 px-2 py-1">
            <AnimatePresence initial={false}>
              {pinned.length > 0 && (
                <ConversationGroup
                  label="Pinned"
                  items={pinned}
                  activeId={activeId}
                  onSelect={setActive}
                  onDelete={deleteConversation}
                  onPin={pinConversation}
                  colors={COLORS}
                />
              )}
              {recent.length > 0 && (
                <ConversationGroup
                  label={pinned.length > 0 ? 'Recent' : undefined}
                  items={recent}
                  activeId={activeId}
                  onSelect={setActive}
                  onDelete={deleteConversation}
                  onPin={pinConversation}
                  colors={COLORS}
                />
              )}
              {conversations.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-3 py-12 text-center"
                >
                  <div
                    className="flex items-center justify-center h-10 w-10 rounded-xl"
                    style={{ background: COLORS.accentMuted }}
                  >
                    <Bot size={18} style={{ color: COLORS.accent }} />
                  </div>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>
                    No conversations yet.
                    <br />
                    Start a new chat above.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>

          {/* Bottom: User */}
          <div
            className="px-2 py-2 shrink-0"
            style={{ borderTop: `1px solid ${COLORS.border}` }}
          >
            <UserAvatar />
          </div>
        </div>
      </motion.aside>
    </>
  );
}

/* ── Conversation Group ───────────────────────────────────── */
interface GroupProps {
  label?: string;
  items: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  colors: typeof PALETTES.dark;
}

function ConversationGroup({ label, items, activeId, onSelect, onDelete, onPin, colors }: GroupProps) {
  return (
    <div className="mb-3">
      {label && (
        <p
          className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: colors.textMuted }}
        >
          {label}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeId}
            onSelect={onSelect}
            onDelete={onDelete}
            onPin={onPin}
            colors={colors}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Conversation Item ────────────────────────────────────── */
interface ItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  colors: typeof PALETTES.dark;
}

function ConversationItem({ conversation, isActive, onSelect, onDelete, onPin, colors }: ItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group relative flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer"
      style={{
        background: isActive ? colors.bgActive : 'transparent',
        border: isActive ? `1px solid ${colors.accentBorder}` : '1px solid transparent',
      }}
      onClick={() => onSelect(conversation.id)}
      whileHover={{
        background: isActive ? colors.bgActive : colors.bgHover,
        borderColor: isActive ? colors.accentBorder : colors.border,
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium truncate"
          style={{ color: isActive ? colors.accent : colors.textPrimary }}
        >
          {truncate(conversation.title, 28)}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
          {formatDate(conversation.updatedAt)}
        </p>
      </div>

      {/* Action buttons on hover */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        <ActionBtn
          label={conversation.isPinned ? 'Unpin' : 'Pin'}
          onClick={(e) => { e.stopPropagation(); onPin(conversation.id, !conversation.isPinned); }}
          icon={<Pin size={11} />}
          colors={colors}
        />
        <ActionBtn
          label="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete(conversation.id); }}
          icon={<Trash2 size={11} />}
          danger
          colors={colors}
        />
      </div>
    </motion.div>
  );
}

interface ActionBtnProps {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  danger?: boolean;
  colors: typeof PALETTES.dark;
}

const ActionBtn = forwardRef<HTMLButtonElement, ActionBtnProps & Omit<HTMLMotionProps<'button'>, 'onClick'>>(
  ({ label, onClick, icon, danger, colors, ...props }, ref) => {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <motion.button
              ref={ref}
              type="button"
              className="flex items-center justify-center h-5 w-5 rounded cursor-pointer"
              style={{ color: danger ? colors.error : colors.textMuted }}
              whileHover={{ background: danger ? 'rgba(239,68,68,0.1)' : colors.bgOverlay }}
              whileTap={{ scale: 0.9 }}
              onClick={onClick}
              aria-label={label}
              {...props}
            >
              {icon}
            </motion.button>
          }
        />
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    );
  }
);
ActionBtn.displayName = 'ActionBtn';