// ============================================================
// DocumentProcessor
//
// Orchestrates the full text-extraction + chunking pipeline
// for a single document. Designed to be source-agnostic:
// callers only need a document ID; they don't know whether the
// document came from a web upload, WhatsApp, CLI, etc.
//
// Pipeline:
//   1. Mark document as 'processing'
//   2. Resolve absolute file path
//   3. Extract text via the parser registry
//   4. Persist extracted text via storage provider
//   5. Chunk text via chunking service
//   6. Bulk-insert DocumentChunk records
//   7. Mark document as 'ready' with metadata
//   On any error → mark document as 'error' + store errorMessage
// ============================================================
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../db/mongoose';
import { KbDocumentModel, DocumentChunkModel } from '../db/models';
import type { IKbDocument } from '../db/models/KbDocument';
import { getParser } from './parsers/parserRegistry';
import { chunkText } from './chunking/chunkingService';
import { storageProvider } from './storage';
import { updateDocumentStatus } from './kbDocumentService';

export async function processDocument(docId: string): Promise<void> {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(docId)) {
    console.error(`[DocumentProcessor] Invalid docId: ${docId}`);
    return;
  }

  // ── 1. Load the document record ───────────────────────────
  const doc = await KbDocumentModel.findById(docId).lean<IKbDocument>();
  if (!doc) {
    console.error(`[DocumentProcessor] Document not found: ${docId}`);
    return;
  }

  const kbId = doc.knowledgeBaseId.toString();

  try {
    // ── 2. Mark as processing ─────────────────────────────
    await updateDocumentStatus(docId, 'processing', {
      processingStartedAt: new Date(),
    });

    // ── 3. Resolve absolute path ──────────────────────────
    const absolutePath = path.resolve(process.cwd(), doc.storagePath);

    // ── 4. Extract text ───────────────────────────────────
    const parser = getParser(doc.fileType);
    const rawText = await parser.extractText(absolutePath);

    // ── 5. Persist extracted text ─────────────────────────
    // Stored as <kbId>/<docId>.txt so re-chunking/re-embedding
    // can read back the text without re-parsing the original file.
    const { path: extractedTextPath } = await storageProvider.saveText(
      kbId,
      `${docId}.txt`,
      rawText
    );

    // ── 6. Chunk the text ─────────────────────────────────
    const chunks = chunkText(rawText);

    // ── 7. Bulk-insert chunks ─────────────────────────────
    if (chunks.length > 0) {
      const objectId = new mongoose.Types.ObjectId(docId);
      const kbObjectId = doc.knowledgeBaseId;

      await DocumentChunkModel.insertMany(
        chunks.map((c) => ({
          documentId: objectId,
          knowledgeBaseId: kbObjectId,
          index: c.index,
          text: c.text,
          charStart: c.charStart,
          charEnd: c.charEnd,
        }))
      );
    }

    // ── 8. Mark as ready ──────────────────────────────────
    await updateDocumentStatus(docId, 'ready', {
      charCount: rawText.length,
      chunkCount: chunks.length,
      parserVersion: parser.version,
      extractedTextPath,
      processedAt: new Date(),
    });

    console.log(
      `[DocumentProcessor] ✓ ${doc.filename} — ${chunks.length} chunks (${rawText.length} chars)`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[DocumentProcessor] ✗ ${doc.filename}:`, message);

    await updateDocumentStatus(docId, 'error', {
      errorMessage: message,
      processedAt: new Date(),
    });
  }
}
