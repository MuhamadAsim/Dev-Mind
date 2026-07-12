'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KbListView } from './KbListView';
import { KbDetailView } from './KbDetailView';
import type { KnowledgeBaseSummary } from '@/server/knowledge/types';

const PALETTES = {
  dark: {
    bgSurface: '#161b27',
    bgElevated: '#1e2433',
    bgOverlay: '#262d3f',
    bgHover: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.10)',
    borderHover: 'rgba(255,255,255,0.18)',
    accent: '#6366f1',
    accentBorder: 'rgba(99,102,241,0.40)',
    accentMuted: 'rgba(99,102,241,0.15)',
    textPrimary: '#ffffff',
    textMuted: '#94a3b8',
    error: '#ef4444',
    success: '#22c55e',
  },
  light: {
    bgSurface: '#ffffff',
    bgElevated: '#f8fafc',
    bgOverlay: '#e2e8f0',
    bgHover: 'rgba(0,0,0,0.05)',
    border: 'rgba(0,0,0,0.10)',
    borderHover: 'rgba(0,0,0,0.20)',
    accent: '#6366f1',
    accentBorder: 'rgba(99,102,241,0.40)',
    accentMuted: 'rgba(99,102,241,0.15)',
    textPrimary: '#000000',
    textMuted: '#334155',
    error: '#ef4444',
    success: '#16a34a',
  },
};

export function KnowledgePanel() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const colors = mounted && resolvedTheme === 'light' ? PALETTES.light : PALETTES.dark;

  const [selectedKb, setSelectedKb] = useState<KnowledgeBaseSummary | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: colors.bgSurface }}>
      <AnimatePresence mode="wait" initial={false}>
        {selectedKb ? (
          <motion.div
            key={`detail-${selectedKb.id}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="flex flex-col h-full"
          >
            <KbDetailView
              kb={selectedKb}
              onBack={() => setSelectedKb(null)}
              colors={colors}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="flex flex-col h-full"
          >
            <KbListView
              onSelect={setSelectedKb}
              colors={colors}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
