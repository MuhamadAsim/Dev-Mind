'use client';

import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-lg" style={{ background: 'var(--color-bg-elevated)' }} />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Tooltip>
      {/* FIX: motion.button passed via `render`, not as a child — stops
          TooltipTrigger from rendering a second nested <button>. */}
      <TooltipTrigger
        render={
          <motion.button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="relative flex items-center justify-center rounded-lg h-8 w-8 cursor-pointer focus-visible:outline-none"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            whileHover={{
              background: 'var(--color-bg-overlay)',
              color: 'var(--color-text-primary)',
              borderColor: 'var(--color-border-hover)',
            }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.15 }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.div
                  key="moon"
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon size={15} />
                </motion.div>
              ) : (
                <motion.div
                  key="sun"
                  initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun size={15} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        }
      />
      <TooltipContent side="bottom">
        {isDark ? 'Light mode' : 'Dark mode'}
      </TooltipContent>
    </Tooltip>
  );
}