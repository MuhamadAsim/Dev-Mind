'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Trash2,
  RefreshCw,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { UploadDropzone } from './UploadDropzone';
import type { KnowledgeBaseSummary, KbDocumentSummary } from '@/server/knowledge/types';

interface KbDetailViewProps {
  kb: KnowledgeBaseSummary;
  onBack: () => void;
  colors: {
    bgSurface: string;
    bgElevated: string;
    bgOverlay: string;
    bgHover: string;
    border: string;
    borderHover: string;
    accent: string;
    accentBorder: string;
    accentMuted: string;
    textPrimary: string;
    textMuted: string;
    error: string;
    success: string;
  };
}

export function KbDetailView({ kb, onBack, colors }: KbDetailViewProps) {
  const [documents, setDocuments] = useState<KbDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/knowledge/${kb.id}/documents`);
      if (!res.ok) return;
      const data = await res.json() as { documents: KbDocumentSummary[] };
      setDocuments(data.documents);

      // Track which documents still need polling
      const processingIds = new Set(
        data.documents
          .filter((d) => d.status === 'pending' || d.status === 'processing')
          .map((d) => d.id)
      );
      setPollingIds(processingIds);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [kb.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll every 2s while any document is pending/processing
  useEffect(() => {
    if (pollingIds.size === 0) return;
    const interval = setInterval(fetchDocuments, 2000);
    return () => clearInterval(interval);
  }, [pollingIds.size, fetchDocuments]);

  const handleDelete = async (docId: string) => {
    if (deletingIds.has(docId)) return;
    setDeletingIds((prev) => new Set(prev).add(docId));
    try {
      await fetch(`/api/knowledge/${kb.id}/documents/${docId}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      // silent
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: colors.bgSurface }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <motion.button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center h-7 w-7 rounded-lg cursor-pointer shrink-0"
          style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
          whileHover={{ background: colors.bgElevated, color: colors.textPrimary }}
          whileTap={{ scale: 0.92 }}
          aria-label="Back to knowledge bases"
          id="kb-back-btn"
        >
          <ArrowLeft size={14} />
        </motion.button>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate" style={{ color: colors.textPrimary }}>
            {kb.name}
          </h2>
          {kb.description && (
            <p className="text-[11px] truncate mt-0.5" style={{ color: colors.textMuted }}>
              {kb.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <motion.button
            type="button"
            onClick={fetchDocuments}
            className="flex items-center justify-center h-7 w-7 rounded-lg cursor-pointer"
            style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
            whileHover={{ background: colors.bgElevated, color: colors.textPrimary }}
            whileTap={{ scale: 0.92 }}
            aria-label="Refresh documents"
            id="kb-refresh-btn"
          >
            <RefreshCw size={13} />
          </motion.button>

          <motion.button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer"
            style={{
              background: showUpload ? colors.accentMuted : 'transparent',
              border: `1px solid ${showUpload ? colors.accentBorder : colors.border}`,
              color: showUpload ? colors.accent : colors.textPrimary,
            }}
            whileHover={{ background: colors.accentMuted, borderColor: colors.accentBorder, color: colors.accent }}
            whileTap={{ scale: 0.97 }}
            id="kb-upload-toggle-btn"
          >
            <Upload size={12} />
            Upload
            {showUpload ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </motion.button>
        </div>
      </div>

      {/* Upload panel — collapsible */}
      <AnimatePresence initial={false}>
        {showUpload && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
              <UploadDropzone
                kbId={kb.id}
                onUploadComplete={() => {
                  fetchDocuments();
                }}
                colors={colors}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Documents list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
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

        {!loading && documents.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-3 py-16 text-center"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: colors.accentMuted }}
            >
              <FileText size={20} style={{ color: colors.accent }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                No documents yet
              </p>
              <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                Upload PDF, DOCX, TXT, or Markdown files above.
              </p>
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {documents.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: deletingIds.has(doc.id) ? 0.4 : 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="group flex items-start gap-3 rounded-xl p-3"
              style={{
                background: colors.bgElevated,
                border: `1px solid ${colors.border}`,
              }}
            >
              {/* File icon */}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5"
                style={{ background: colors.bgOverlay }}
              >
                <FileText size={14} style={{ color: colors.accent }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: colors.textPrimary }}>
                  {doc.filename}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <DocumentStatusBadge status={doc.status} />
                  <span className="text-[10px]" style={{ color: colors.textMuted }}>
                    {formatBytes(doc.sizeBytes)}
                  </span>
                  {doc.status === 'ready' && doc.chunkCount !== undefined && (
                    <span className="text-[10px]" style={{ color: colors.textMuted }}>
                      {doc.chunkCount} chunks
                    </span>
                  )}
                  {doc.status === 'error' && doc.errorMessage && (
                    <span className="text-[10px] truncate max-w-[160px]" style={{ color: colors.error }} title={doc.errorMessage}>
                      {doc.errorMessage}
                    </span>
                  )}
                </div>
                {doc.parserVersion && (
                  <p className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
                    {doc.parserVersion}
                  </p>
                )}
              </div>

              {/* Delete */}
              <motion.button
                type="button"
                onClick={() => handleDelete(doc.id)}
                disabled={deletingIds.has(doc.id)}
                className="hidden group-hover:flex items-center justify-center h-6 w-6 rounded-lg cursor-pointer shrink-0"
                style={{ color: colors.textMuted }}
                whileHover={{ background: 'rgba(239,68,68,0.10)', color: colors.error }}
                whileTap={{ scale: 0.9 }}
                aria-label={`Delete ${doc.filename}`}
              >
                <Trash2 size={12} />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer stats */}
      {!loading && documents.length > 0 && (
        <div
          className="px-5 py-2.5 shrink-0 flex items-center gap-3"
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          <p className="text-[11px]" style={{ color: colors.textMuted }}>
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </p>
          <span style={{ color: colors.border }}>·</span>
          <p className="text-[11px]" style={{ color: colors.textMuted }}>
            {documents.filter((d) => d.status === 'ready').length} ready
          </p>
          {documents.some((d) => d.status === 'processing' || d.status === 'pending') && (
            <>
              <span style={{ color: colors.border }}>·</span>
              <p className="text-[11px] animate-pulse" style={{ color: colors.accent }}>
                Processing…
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
