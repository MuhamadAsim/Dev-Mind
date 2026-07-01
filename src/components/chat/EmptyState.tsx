'use client';

import { motion } from 'framer-motion';
import { Sparkles, Code2, BookOpen, Zap, GitBranch, FileSearch } from 'lucide-react';
import { MOCK_SUGGESTIONS } from '@/lib/constants';

const ICONS = [Sparkles, Code2, BookOpen, Zap, GitBranch, FileSearch];

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export function EmptyState({ onSelectPrompt }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6 py-12 text-center">
      {/* Hero */}
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Animated icon cluster */}
        <div className="flex justify-center mb-2">
          <motion.div
            className="relative flex items-center justify-center h-16 w-16 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
              border: '1px solid var(--color-accent-border)',
            }}
            animate={{
              boxShadow: [
                '0 0 16px rgba(99,102,241,0.2)',
                '0 0 32px rgba(99,102,241,0.4)',
                '0 0 16px rgba(99,102,241,0.2)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles size={28} style={{ color: 'white' }} />
          </motion.div>
        </div>

        <h2
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          How can I help you today?
        </h2>
        <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          Ask me anything about your code, architecture, debugging, or software engineering.
        </p>
      </motion.div>

      {/* Suggestion grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {MOCK_SUGGESTIONS.map((suggestion, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <motion.button
              key={suggestion}
              onClick={() => onSelectPrompt(suggestion)}
              className="flex items-start gap-3 rounded-xl p-3.5 text-left cursor-pointer group"
              style={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
              }}
              whileHover={{
                borderColor: 'var(--color-accent-border)',
                background: 'var(--color-accent-muted)',
              }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
            >
              <div
                className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-0.5"
                style={{ background: 'var(--color-accent-muted)' }}
              >
                <Icon
                  size={13}
                  style={{ color: 'var(--color-accent)' }}
                  className="group-hover:scale-110 transition-transform"
                />
              </div>
              <span
                className="text-xs leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {suggestion}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
