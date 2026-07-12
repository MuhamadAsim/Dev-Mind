// ============================================================
// Knowledge module — shared types and DTOs
// ============================================================
import type { DocumentFileType, DocumentStatus } from '../db/models/KbDocument';

export type { DocumentFileType, DocumentStatus };

// ── DTOs ─────────────────────────────────────────────────────
// These are the shapes returned by API routes — plain objects,
// no Mongoose Document methods, safe to JSON-serialize.

export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description?: string;
  embeddingModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface KbDocumentSummary {
  id: string;
  knowledgeBaseId: string;
  filename: string;
  storagePath: string;
  extractedTextPath?: string;
  fileType: DocumentFileType;
  sizeBytes: number;
  status: DocumentStatus;
  errorMessage?: string;
  charCount?: number;
  chunkCount?: number;
  parserVersion?: string;
  processingStartedAt?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Chunk result ──────────────────────────────────────────────
// Returned by chunkingService.chunkText(), consumed by documentProcessor.

export interface ChunkResult {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
}

// ── Supported file types list ─────────────────────────────────
// Single source of truth — used in upload validation and UI accept lists.
export const SUPPORTED_FILE_TYPES: DocumentFileType[] = ['pdf', 'docx', 'txt', 'md'];
export const SUPPORTED_MIME_TYPES: Record<string, DocumentFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
};

/** Map file extension → DocumentFileType */
export const EXTENSION_TO_FILE_TYPE: Record<string, DocumentFileType> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.txt': 'txt',
  '.md': 'md',
};
