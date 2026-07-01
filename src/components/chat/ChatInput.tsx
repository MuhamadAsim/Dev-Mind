'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Paperclip, Mic, Loader2 } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading = false, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setValue('');
    textareaRef.current?.focus();
  }, [value, isLoading, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-[var(--chat-max-width)] mx-auto">
        <motion.div
          className="relative flex flex-col rounded-2xl overflow-hidden"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
          }}
          animate={{
            borderColor: value.length > 0 ? 'var(--color-border-focus)' : 'var(--color-border)',
            boxShadow: value.length > 0
              ? '0 0 0 3px rgba(99,102,241,0.08)'
              : '0 0 0 0 transparent',
          }}
          transition={{ duration: 0.2 }}
        >
          {/* Textarea */}
          <TextareaAutosize
            ref={textareaRef}
            id="chat-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask DevMind AI anything…"
            minRows={1}
            maxRows={12}
            disabled={disabled}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm outline-none placeholder:opacity-55 disabled:opacity-50"
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sans)',
              lineHeight: '1.6',
            }}
            aria-label="Chat message input"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 pb-2.5 gap-2">
            {/* Left actions */}
            <div className="flex items-center gap-1">
              {/* Attach file — fed to TooltipTrigger via `render` so it merges
                  trigger props onto THIS button instead of wrapping it in a
                  second <button>. Nesting buttons is invalid HTML and causes
                  a hydration mismatch. */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <motion.button
                      type="button"
                      className="flex items-center justify-center h-7 w-7 rounded-lg cursor-not-allowed opacity-50"
                      style={{ color: 'var(--color-text-muted)' }}
                      whileHover={{ background: 'var(--color-bg-overlay)' }}
                      aria-label="Attach file (coming soon)"
                      aria-disabled="true"
                      onClick={(e) => e.preventDefault()} // block action, but keep hover/focus events alive for the tooltip
                    >
                      <Paperclip size={14} />
                    </motion.button>
                  }
                />
                <TooltipContent side="top">Attach file (coming soon)</TooltipContent>
              </Tooltip>

              {/* Voice input — same pattern as above */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <motion.button
                      type="button"
                      className="flex items-center justify-center h-7 w-7 rounded-lg cursor-not-allowed opacity-50"
                      style={{ color: 'var(--color-text-muted)' }}
                      whileHover={{ background: 'var(--color-bg-overlay)' }}
                      aria-label="Voice input (coming soon)"
                      aria-disabled="true"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Mic size={14} />
                    </motion.button>
                  }
                />
                <TooltipContent side="top">Voice input (coming soon)</TooltipContent>
              </Tooltip>
            </div>

            {/* Right: hint + send */}
            <div className="flex items-center gap-2">
              <AnimatePresence>
                {value.length > 0 && (
                  <motion.span
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="text-[10px] hidden sm:block"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    ↵ Send · Shift+↵ New line
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Send button is standalone (no tooltip wrapper), so it's fine as-is */}
              <motion.button
                id="send-message-btn"
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="flex items-center justify-center h-8 w-8 rounded-xl cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: canSend
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'var(--color-bg-overlay)',
                  color: canSend ? '#fff' : 'var(--color-text-muted)',
                }}
                whileHover={canSend ? { scale: 1.05 } : {}}
                whileTap={canSend ? { scale: 0.93 } : {}}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                aria-label="Send message"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                    >
                      <Loader2 size={14} className="animate-spin" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="send"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                    >
                      <ArrowUp size={14} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </motion.div>

        <p className="text-center mt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          DevMind AI can make mistakes. Always verify critical code.
        </p>
      </div>
    </div>
  );
}