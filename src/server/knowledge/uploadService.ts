// ============================================================
// UploadService — source-agnostic upload entry point
//
// Accepts a raw Buffer so any upload source (web, WhatsApp,
// CLI, future Telegram bot, etc.) can use the same pipeline.
// HTTP-specific code (FormData, NextRequest) never enters here.
//
// Flow:
//   saveFile → createDocument(pending) → fire-and-forget processDocument
//   → return document summary immediately (status = 'pending')
//
// The caller does not wait for processing to complete.
// Clients poll /api/knowledge/:id/documents/:docId to watch status.
// ============================================================
import path from 'path';
import { storageProvider } from './storage';
import { createDocument } from './kbDocumentService';
import { processDocument } from './documentProcessor';
import type { DocumentFileType, KbDocumentSummary } from './types';
import { EXTENSION_TO_FILE_TYPE, SUPPORTED_FILE_TYPES } from './types';

export interface ProcessUploadParams {
  /** Target Knowledge Base ID */
  kbId: string;
  /** Original filename as sent by the client, e.g. "report.pdf" */
  filename: string;
  /** Raw binary content of the uploaded file */
  buffer: Buffer;
  /**
   * Optional explicit file type override.
   * If not provided, the type is inferred from the filename extension.
   */
  fileType?: DocumentFileType;
}

/**
 * Run the upload pipeline for a single file.
 *
 * Returns immediately with status='pending'.
 * Processing (text extraction + chunking) runs asynchronously.
 */
export async function processUpload(
  params: ProcessUploadParams
): Promise<KbDocumentSummary> {
  const { kbId, filename, buffer, fileType: explicitType } = params;

  // ── Resolve file type ─────────────────────────────────────
  const ext = path.extname(filename).toLowerCase();
  const fileType: DocumentFileType = explicitType ?? EXTENSION_TO_FILE_TYPE[ext];

  if (!fileType || !SUPPORTED_FILE_TYPES.includes(fileType)) {
    throw new Error(
      `Unsupported file type "${ext}". Supported: ${SUPPORTED_FILE_TYPES.join(', ')}`
    );
  }

  // ── Save file to storage ──────────────────────────────────
  const { path: storagePath, sizeBytes } = await storageProvider.saveFile(
    kbId,
    filename,
    buffer
  );

  // ── Create document record (status: pending) ──────────────
  const document = await createDocument({
    kbId,
    filename,
    storagePath,
    fileType,
    sizeBytes,
  });

  // ── Fire-and-forget processing ────────────────────────────
  // Do NOT await — we return the 'pending' record immediately.
  // processDocument handles its own error boundary and status updates.
  processDocument(document.id).catch((err) => {
    console.error(`[UploadService] processDocument failed for ${document.id}:`, err);
  });

  return document;
}
