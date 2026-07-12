// ============================================================
// KbDocument Model — separate collection (not embedded in KnowledgeBase)
//
// Named "KbDocument" (not "Document") to avoid conflict with
// Mongoose's built-in Document type.
//
// Using a separate collection rather than embedding gives us:
//   - Efficient listing / filtering without loading chunk data
//   - Independent status tracking per document
//   - Granular deletes without rewriting the parent document
//   - Ready for future: per-document re-processing, re-chunking
// ============================================================
import mongoose, { Schema, Document, Model } from 'mongoose';

// ── Types ─────────────────────────────────────────────────────

/**
 * Processing lifecycle for an uploaded document.
 *
 * pending     → file saved, waiting for processor to pick it up
 * processing  → text extraction + chunking in progress
 * ready       → fully processed; chunks are in DocumentChunk collection
 * error       → processing failed; see errorMessage field
 */
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error';

/**
 * Supported file types — add new values here when new parsers are added.
 * The parser registry maps each type to a DocumentParser implementation.
 */
export type DocumentFileType = 'pdf' | 'docx' | 'txt' | 'md';

// ── TypeScript interface ──────────────────────────────────────

export interface IKbDocument extends Document {
  knowledgeBaseId: mongoose.Types.ObjectId;
  /** Original uploaded filename, e.g. "resume.pdf" */
  filename: string;
  /**
   * Relative path from project root to the stored file.
   * Example: "storage/uploads/<kbId>/resume.pdf"
   */
  storagePath: string;
  /**
   * Relative path to the persisted extracted text file.
   * Example: "storage/extracted/<kbId>/<docId>.txt"
   * Populated after successful text extraction.
   * Allows re-chunking / re-embedding without re-reading the original.
   */
  extractedTextPath?: string;
  fileType: DocumentFileType;
  sizeBytes: number;
  status: DocumentStatus;
  /** Populated when status transitions to 'error' */
  errorMessage?: string;
  /** Character count of the extracted text */
  charCount?: number;
  /** Number of DocumentChunk records created */
  chunkCount?: number;
  /**
   * Version string of the parser used, e.g. "pdf-parse@1.1.1".
   * Useful for detecting when documents should be re-processed
   * after a parser upgrade.
   */
  parserVersion?: string;
  /** Timestamp when the processor started working on this document */
  processingStartedAt?: Date;
  /** Timestamp when processing completed (successfully or not) */
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ────────────────────────────────────────────────────

const KbDocumentSchema = new Schema<IKbDocument>(
  {
    knowledgeBaseId: {
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeBase',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    extractedTextPath: {
      type: String,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'docx', 'txt', 'md'] satisfies DocumentFileType[],
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'error'] satisfies DocumentStatus[],
      default: 'pending',
    },
    errorMessage: {
      type: String,
    },
    charCount: {
      type: Number,
    },
    chunkCount: {
      type: Number,
    },
    parserVersion: {
      type: String,
    },
    processingStartedAt: {
      type: Date,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index: fetch all documents for a KB sorted by upload time
KbDocumentSchema.index({ knowledgeBaseId: 1, createdAt: -1 });
// Index for status-based queries (e.g. "find all pending documents")
KbDocumentSchema.index({ status: 1 });

// ── Model ─────────────────────────────────────────────────────

export const KbDocumentModel: Model<IKbDocument> =
  mongoose.models.KbDocument ??
  mongoose.model<IKbDocument>('KbDocument', KbDocumentSchema);
