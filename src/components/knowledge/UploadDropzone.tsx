'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];
const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
];

interface UploadedFile {
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadDropzoneProps {
  kbId: string;
  onUploadComplete?: () => void;
  colors: {
    bgElevated: string;
    bgOverlay: string;
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

export function UploadDropzone({ kbId, onUploadComplete, colors }: UploadDropzoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return ACCEPTED_EXTENSIONS.includes(ext) || ACCEPTED_MIME.includes(f.type);
    });
    setFiles((prev) => [
      ...prev,
      ...valid.map((f): UploadedFile => ({ file: f, status: 'queued' })),
    ]);
    // Start uploading immediately
    valid.forEach((f) => uploadFile(f));
  };

  const uploadFile = async (file: File) => {
    setFiles((prev) =>
      prev.map((uf) => (uf.file === file ? { ...uf, status: 'uploading' } : uf))
    );
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/knowledge/${kbId}/documents`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setFiles((prev) =>
        prev.map((uf) => (uf.file === file ? { ...uf, status: 'done' } : uf))
      );
      onUploadComplete?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setFiles((prev) =>
        prev.map((uf) => (uf.file === file ? { ...uf, status: 'error', error: message } : uf))
      );
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbId]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const removeFile = (file: File) =>
    setFiles((prev) => prev.filter((uf) => uf.file !== file));

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <motion.div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        animate={{
          borderColor: isDragging ? colors.accent : colors.border,
          background: isDragging ? colors.accentMuted : colors.bgElevated,
        }}
        transition={{ duration: 0.15 }}
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer select-none"
        style={{ borderColor: colors.border, background: colors.bgElevated }}
        role="button"
        aria-label="Upload files"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        id="upload-dropzone"
      >
        <motion.div
          animate={{ scale: isDragging ? 1.12 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: isDragging ? colors.accentMuted : colors.bgOverlay }}
        >
          <Upload size={20} style={{ color: isDragging ? colors.accent : colors.textMuted }} />
        </motion.div>

        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            {isDragging ? 'Drop files here' : 'Drag & drop or click to upload'}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: colors.textMuted }}>
            PDF, DOCX, TXT, Markdown — up to 50 MB each
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
          aria-label="File input"
        />
      </motion.div>

      {/* File list */}
      <AnimatePresence initial={false}>
        {files.map((uf, i) => (
          <motion.div
            key={`${uf.file.name}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5"
            style={{ background: colors.bgOverlay, border: `1px solid ${colors.border}` }}
          >
            <FileText size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: colors.textPrimary }}>
                {uf.file.name}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
                {(uf.file.size / 1024).toFixed(1)} KB
                {uf.status === 'uploading' && ' · Uploading…'}
                {uf.status === 'done' && ' · Uploaded'}
                {uf.status === 'error' && ` · ${uf.error}`}
              </p>
            </div>

            {uf.status === 'uploading' && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="h-4 w-4 rounded-full border-2 border-t-transparent shrink-0"
                style={{ borderColor: colors.accent, borderTopColor: 'transparent' }}
              />
            )}
            {uf.status === 'done' && (
              <CheckCircle2 size={14} style={{ color: colors.success, flexShrink: 0 }} />
            )}
            {uf.status === 'error' && (
              <AlertCircle size={14} style={{ color: colors.error, flexShrink: 0 }} />
            )}
            {(uf.status === 'done' || uf.status === 'error') && (
              <button
                type="button"
                onClick={() => removeFile(uf.file)}
                className="flex items-center justify-center h-4 w-4 rounded cursor-pointer"
                style={{ color: colors.textMuted }}
                aria-label="Remove"
              >
                <X size={11} />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
