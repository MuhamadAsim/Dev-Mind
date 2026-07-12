// ============================================================
// KbDocument Service — CRUD for KbDocument collection
// ============================================================
import mongoose from 'mongoose';
import { connectDB } from '../db/mongoose';
import { KbDocumentModel, DocumentChunkModel } from '../db/models';
import type { IKbDocument, DocumentStatus, DocumentFileType } from '../db/models/KbDocument';
import type { KbDocumentSummary } from './types';
import { storageProvider } from './storage';

// ── Helpers ───────────────────────────────────────────────────

function toSummary(doc: IKbDocument): KbDocumentSummary {
  return {
    id: (doc._id as mongoose.Types.ObjectId).toString(),
    knowledgeBaseId: doc.knowledgeBaseId.toString(),
    filename: doc.filename,
    storagePath: doc.storagePath,
    extractedTextPath: doc.extractedTextPath,
    fileType: doc.fileType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    errorMessage: doc.errorMessage,
    charCount: doc.charCount,
    chunkCount: doc.chunkCount,
    parserVersion: doc.parserVersion,
    processingStartedAt: doc.processingStartedAt?.toISOString(),
    processedAt: doc.processedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────

export async function listDocuments(kbId: string): Promise<KbDocumentSummary[]> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(kbId)) return [];
  const docs = await KbDocumentModel.find({ knowledgeBaseId: kbId })
    .sort({ createdAt: -1 })
    .lean<IKbDocument[]>();
  return docs.map(toSummary);
}

export async function getDocument(id: string): Promise<KbDocumentSummary | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await KbDocumentModel.findById(id).lean<IKbDocument>();
  return doc ? toSummary(doc) : null;
}

export async function createDocument(params: {
  kbId: string;
  filename: string;
  storagePath: string;
  fileType: DocumentFileType;
  sizeBytes: number;
}): Promise<KbDocumentSummary> {
  await connectDB();
  const doc = await KbDocumentModel.create({
    knowledgeBaseId: new mongoose.Types.ObjectId(params.kbId),
    filename: params.filename,
    storagePath: params.storagePath,
    fileType: params.fileType,
    sizeBytes: params.sizeBytes,
    status: 'pending',
  });
  return toSummary(doc);
}

export interface UpdateStatusOptions {
  errorMessage?: string;
  charCount?: number;
  chunkCount?: number;
  parserVersion?: string;
  extractedTextPath?: string;
  processingStartedAt?: Date;
  processedAt?: Date;
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  opts?: UpdateStatusOptions
): Promise<void> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return;

  const update: Partial<IKbDocument> = { status };
  if (opts?.errorMessage !== undefined) update.errorMessage = opts.errorMessage;
  if (opts?.charCount !== undefined) update.charCount = opts.charCount;
  if (opts?.chunkCount !== undefined) update.chunkCount = opts.chunkCount;
  if (opts?.parserVersion !== undefined) update.parserVersion = opts.parserVersion;
  if (opts?.extractedTextPath !== undefined) update.extractedTextPath = opts.extractedTextPath;
  if (opts?.processingStartedAt !== undefined) update.processingStartedAt = opts.processingStartedAt;
  if (opts?.processedAt !== undefined) update.processedAt = opts.processedAt;

  await KbDocumentModel.findByIdAndUpdate(id, update);
}

/**
 * Delete a document and cascade-delete:
 *   - All DocumentChunk records for this document
 *   - The physical file on disk (uploads + extracted text)
 */
export async function deleteDocument(id: string): Promise<boolean> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return false;

  const doc = await KbDocumentModel.findByIdAndDelete(id).lean<IKbDocument>();
  if (!doc) return false;

  await Promise.all([
    DocumentChunkModel.deleteMany({ documentId: new mongoose.Types.ObjectId(id) }),
    storageProvider.deleteFile(doc.storagePath),
    doc.extractedTextPath
      ? storageProvider.deleteFile(doc.extractedTextPath)
      : Promise.resolve(),
  ]);

  return true;
}
