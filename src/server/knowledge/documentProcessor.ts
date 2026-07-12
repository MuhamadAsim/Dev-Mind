// ============================================================
// DocumentProcessor
//
// Orchestrates the text-extraction + chunking + embedding pipeline
// for a single document.
//
// Pipeline:
//   1. Mark document as 'processing'
//   2. Extract text via the parser registry (skipped in reindexDocument)
//   3. Persist extracted text via storage provider (skipped in reindexDocument)
//   4. Chunk text via chunking service
//   5. Generate vector embeddings in batches of 32
//   6. Clear any pre-existing chunks for this document
//   7. Bulk-save Chunks + Embeddings in the Vector Store
//   8. Mark document as 'ready' with updated counts
//   On any error → mark document as 'error' + store errorMessage
// ============================================================
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../db/mongoose';
import { KbDocumentModel } from '../db/models';
import type { IKbDocument } from '../db/models/KbDocument';
import { getParser } from './parsers/parserRegistry';
import { chunkText } from './chunking/chunkingService';
import { storageProvider } from './storage';
import { updateDocumentStatus } from './kbDocumentService';
import { getEmbeddings } from './embeddingService';
import { vectorStoreProvider } from './storage/vectorStore';

/**
 * Full extraction + chunking + embedding processing pipeline.
 * Runs asynchronously and updates status on completion or failure.
 */
export async function processDocument(docId: string): Promise<void> {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(docId)) {
    console.error(`[DocumentProcessor] Invalid docId: ${docId}`);
    return;
  }

  const doc = await KbDocumentModel.findById(docId).lean<IKbDocument>();
  if (!doc) {
    console.error(`[DocumentProcessor] Document not found: ${docId}`);
    return;
  }

  const kbId = doc.knowledgeBaseId.toString();

  try {
    await updateDocumentStatus(docId, 'processing', {
      processingStartedAt: new Date(),
    });

    // ── 1. Extract text ───────────────────────────────────
    const absolutePath = path.resolve(process.cwd(), doc.storagePath);
    const parser = getParser(doc.fileType);
    const rawText = await parser.extractText(absolutePath);

    // ── 2. Persist extracted text ─────────────────────────
    const { path: extractedTextPath } = await storageProvider.saveText(
      kbId,
      `${docId}.txt`,
      rawText
    );

    // ── 3. Chunk the text ─────────────────────────────────
    const chunks = chunkText(rawText);

    // ── 4. Generate query embeddings (batched in 32s) ─────
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await getEmbeddings(chunkTexts);

    // ── 5. Clear old chunks (safeguard) ───────────────────
    await vectorStoreProvider.deleteChunksByDocument(docId);

    // ── 6. Save new chunks + embeddings ───────────────────
    if (chunks.length > 0) {
      await vectorStoreProvider.saveChunks(
        chunks.map((c, i) => ({
          chunkId: new mongoose.Types.ObjectId().toString(),
          documentId: docId,
          knowledgeBaseId: kbId,
          index: c.index,
          text: c.text,
          charStart: c.charStart,
          charEnd: c.charEnd,
          embedding: embeddings[i],
        }))
      );
    }

    // ── 7. Update status to ready ─────────────────────────
    await updateDocumentStatus(docId, 'ready', {
      charCount: rawText.length,
      chunkCount: chunks.length,
      parserVersion: parser.version,
      extractedTextPath,
      processedAt: new Date(),
    });

    console.log(
      `[DocumentProcessor] ✓ Fully processed ${doc.filename} — ${chunks.length} chunks (${rawText.length} chars)`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[DocumentProcessor] ✗ Processing failed for ${doc.filename}:`, message);

    await updateDocumentStatus(docId, 'error', {
      errorMessage: message,
      processedAt: new Date(),
    });
  }
}

/**
 * Regenerate chunks and embeddings without reloading original files.
 * Useful when chunking strategy or embedding models change.
 */
export async function reindexDocument(docId: string): Promise<void> {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(docId)) {
    throw new Error(`Invalid docId: ${docId}`);
  }

  const doc = await KbDocumentModel.findById(docId).lean<IKbDocument>();
  if (!doc) {
    throw new Error(`Document not found: ${docId}`);
  }

  if (!doc.extractedTextPath) {
    throw new Error(`Document ${docId} has no extracted text path. Process it first.`);
  }

  const kbId = doc.knowledgeBaseId.toString();

  try {
    await updateDocumentStatus(docId, 'processing', {
      processingStartedAt: new Date(),
    });

    // ── 1. Read existing extracted text ───────────────────────
    const rawText = await storageProvider.readText(doc.extractedTextPath);

    // ── 2. Re-chunk the text ──────────────────────────────────
    const chunks = chunkText(rawText);

    // ── 3. Generate embeddings (batched in 32s) ───────────────
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await getEmbeddings(chunkTexts);

    // ── 4. Delete old chunks ──────────────────────────────────
    await vectorStoreProvider.deleteChunksByDocument(docId);

    // ── 5. Save new chunks + embeddings ───────────────────────
    if (chunks.length > 0) {
      await vectorStoreProvider.saveChunks(
        chunks.map((c, i) => ({
          chunkId: new mongoose.Types.ObjectId().toString(),
          documentId: docId,
          knowledgeBaseId: kbId,
          index: c.index,
          text: c.text,
          charStart: c.charStart,
          charEnd: c.charEnd,
          embedding: embeddings[i],
        }))
      );
    }

    // ── 6. Update document metadata ──────────────────────────
    await updateDocumentStatus(docId, 'ready', {
      charCount: rawText.length,
      chunkCount: chunks.length,
      processedAt: new Date(),
    });

    console.log(
      `[DocumentProcessor] ✓ Reindexed ${doc.filename} — ${chunks.length} chunks (${rawText.length} chars)`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[DocumentProcessor] ✗ Reindexing failed for ${doc.filename}:`, message);

    await updateDocumentStatus(docId, 'error', {
      errorMessage: `Reindexing error: ${message}`,
      processedAt: new Date(),
    });
    throw err;
  }
}
