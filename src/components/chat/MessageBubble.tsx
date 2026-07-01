'use client';

import { motion } from 'framer-motion';
import { Bot, User, Copy, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';
import { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex gap-3 group ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Assistant avatar */}
      {isAssistant && (
        <div
          className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-1"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
            border: '1px solid var(--color-accent-border)',
          }}
        >
          <Bot size={14} style={{ color: 'var(--color-accent)' }} />
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={
            isUser
              ? {
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                borderBottomRightRadius: 6,
              }
              : {
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                borderBottomLeftRadius: 6,
              }
          }
        >
          {message.isStreaming ? (
            <StreamingIndicator />
          ) : (
            <MessageContent content={message.content} />
          )}
        </div>

        {/* Timestamp + actions */}
        <div
          className={`flex items-center gap-2 px-1 transition-opacity ${isLast ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
        >
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            {formatDate(message.createdAt)}
          </span>

          {isAssistant && !message.isStreaming && (
            <div className="flex items-center gap-0.5">
              <MsgAction label={copied ? 'Copied!' : 'Copy'} onClick={copyToClipboard}>
                <Copy size={10} />
              </MsgAction>
              <MsgAction label="Good response">
                <ThumbsUp size={10} />
              </MsgAction>
              <MsgAction label="Bad response">
                <ThumbsDown size={10} />
              </MsgAction>
              <MsgAction label="Regenerate">
                <RotateCcw size={10} />
              </MsgAction>
            </div>
          )}
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div
          className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-1"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          }}
        >
          <User size={13} style={{ color: '#fff' }} />
        </div>
      )}
    </motion.div>
  );
}

/* ── Streaming Indicator ─────────────────────────────────── */
function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--color-accent)' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

/* ── Message Content — renders plain text (extend later for markdown) */
function MessageContent({ content }: { content: string }) {
  return (
    <p className="whitespace-pre-wrap break-words" style={{ lineHeight: 1.7 }}>
      {content}
    </p>
  );
}

/* ── Message Action Button ───────────────────────────────── */
interface MsgActionProps {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}

function MsgAction({ label, onClick, children }: MsgActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <motion.button
            type="button"
            onClick={onClick}
            className="flex items-center justify-center h-5 w-5 rounded cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            whileHover={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-primary)' }}
            whileTap={{ scale: 0.9 }}
            aria-label={label}
          >
            {children}
          </motion.button>
        }
      />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}