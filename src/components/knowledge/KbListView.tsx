'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Plus, Trash2, ChevronRight, Loader2, X } from 'lucide-react';
import type { KnowledgeBaseSummary } from '@/server/knowledge/types';

interface KbListViewProps {
  onSelect: (kb: KnowledgeBaseSummary) => void;
  colors: {
    bgSurface: string;
    bgElevated: string;
    bgOverlay: string;
    bgHover: string;
    border: string;
    accent: string;
    accentBorder: string;
    accentMuted: string;
    textPrimary: string;
    textMuted: string;
    error: string;
  };
}

export function KbListView({ onSelect, colors }: KbListViewProps) {
  const [kbs, setKbs] = useState<KnowledgeBaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchKbs = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge');
      if (!res.ok) return;
      const data = await res.json() as { knowledgeBases: KnowledgeBaseSummary[] };
      setKbs(data.knowledgeBases);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKbs(); }, [fetchKbs]);

  const handleCreate = async () => {
    if (!createName.trim()) { setCreateError('Name is required.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() || undefined }),
      });
      const data = await res.json() as { knowledgeBase?: KnowledgeBaseSummary; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setKbs((prev) => [data.knowledgeBase!, ...prev]);
      setCreateName('');
      setCreateDesc('');
      setShowCreate(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      setKbs((prev) => prev.filter((kb) => kb.id !== id));
    } catch {
      // silent
    } finally {
      setDeletingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: colors.bgSurface }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: colors.accentMuted }}
          >
            <Brain size={14} style={{ color: colors.accent }} />
          </div>
          <h2 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            Knowledge Bases
          </h2>
        </div>

        <motion.button
          type="button"
          onClick={() => { setShowCreate((v) => !v); setCreateError(''); }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer"
          style={{
            background: showCreate ? colors.accentMuted : 'transparent',
            border: `1px solid ${showCreate ? colors.accentBorder : colors.border}`,
            color: showCreate ? colors.accent : colors.textPrimary,
          }}
          whileHover={{ background: colors.accentMuted, borderColor: colors.accentBorder, color: colors.accent }}
          whileTap={{ scale: 0.97 }}
          id="kb-create-btn"
        >
          {showCreate ? <X size={12} /> : <Plus size={12} />}
          {showCreate ? 'Cancel' : 'New KB'}
        </motion.button>
      </div>

      {/* Create form */}
      <AnimatePresence initial={false}>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-5 py-4 flex flex-col gap-2.5" style={{ borderBottom: `1px solid ${colors.border}` }}>
              <input
                type="text"
                placeholder="Knowledge Base name *"
                value={createName}
                onChange={(e) => { setCreateName(e.target.value); setCreateError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: colors.bgElevated,
                  border: `1px solid ${createError ? colors.error : colors.border}`,
                  color: colors.textPrimary,
                }}
                autoFocus
                id="kb-name-input"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: colors.bgElevated,
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                }}
                id="kb-desc-input"
              />
              {createError && (
                <p className="text-xs" style={{ color: colors.error }}>{createError}</p>
              )}
              <motion.button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center justify-center gap-2 w-full rounded-lg py-2 text-sm font-medium cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, rgba(99,102,241,0.8), rgba(139,92,246,0.8))`,
                  color: '#ffffff',
                  opacity: creating ? 0.7 : 1,
                }}
                whileHover={{ opacity: 0.9 }}
                whileTap={{ scale: 0.98 }}
                id="kb-create-submit-btn"
              >
                {creating && <Loader2 size={13} className="animate-spin" />}
                Create Knowledge Base
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="h-5 w-5 rounded-full border-2 border-t-transparent"
              style={{ borderColor: colors.accent, borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {!loading && kbs.length === 0 && !showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-3 py-16 text-center"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: colors.accentMuted }}
            >
              <Brain size={22} style={{ color: colors.accent }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>No knowledge bases yet</p>
              <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                Create one above to start uploading documents.
              </p>
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {kbs.map((kb) => (
            <motion.div
              key={kb.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: deletingIds.has(kb.id) ? 0.4 : 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="group flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
              style={{
                background: colors.bgElevated,
                border: `1px solid ${colors.border}`,
              }}
              onClick={() => !deletingIds.has(kb.id) && onSelect(kb)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.accent;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.border;
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && !deletingIds.has(kb.id) && onSelect(kb)}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: colors.accentMuted }}
              >
                <Brain size={16} style={{ color: colors.accent }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
                  {kb.name}
                </p>
                {kb.description && (
                  <p className="text-[11px] truncate mt-0.5" style={{ color: colors.textMuted }}>
                    {kb.description}
                  </p>
                )}
                <p className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
                  {new Date(kb.updatedAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {deletingIds.has(kb.id) ? (
                  <Loader2 size={13} className="animate-spin" style={{ color: colors.textMuted }} />
                ) : (
                  <>
                    <motion.button
                      type="button"
                      onClick={(e) => handleDelete(kb.id, e)}
                      className="hidden group-hover:flex items-center justify-center h-6 w-6 rounded-lg cursor-pointer"
                      style={{ color: colors.textMuted }}
                      whileHover={{ background: 'rgba(239,68,68,0.10)', color: colors.error }}
                      whileTap={{ scale: 0.9 }}
                      aria-label={`Delete ${kb.name}`}
                    >
                      <Trash2 size={12} />
                    </motion.button>
                    <ChevronRight size={14} style={{ color: colors.textMuted }} />
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
