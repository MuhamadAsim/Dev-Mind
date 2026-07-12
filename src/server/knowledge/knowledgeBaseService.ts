// ============================================================
// KnowledgeBase Service — CRUD for KnowledgeBase collection
// ============================================================
import mongoose from 'mongoose';
import { connectDB } from '../db/mongoose';
import { KnowledgeBaseModel, KbDocumentModel, DocumentChunkModel } from '../db/models';
import type { IKnowledgeBase } from '../db/models/KnowledgeBase';
import type { KnowledgeBaseSummary } from './types';
import { storageProvider } from './storage';

// ── Helpers ───────────────────────────────────────────────────

function toSummary(doc: IKnowledgeBase): KnowledgeBaseSummary {
  return {
    id: (doc._id as mongoose.Types.ObjectId).toString(),
    name: doc.name,
    description: doc.description,
    embeddingModel: doc.embeddingModel,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────

export async function listKnowledgeBases(): Promise<KnowledgeBaseSummary[]> {
  await connectDB();
  const docs = await KnowledgeBaseModel.find({})
    .sort({ updatedAt: -1 })
    .lean<IKnowledgeBase[]>();
  return docs.map(toSummary);
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBaseSummary | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await KnowledgeBaseModel.findById(id).lean<IKnowledgeBase>();
  return doc ? toSummary(doc) : null;
}

export async function createKnowledgeBase(
  name: string,
  description?: string,
  embeddingModel?: string
): Promise<KnowledgeBaseSummary> {
  await connectDB();
  const doc = await KnowledgeBaseModel.create({
    name: name.trim(),
    description: description?.trim(),
    embeddingModel: embeddingModel ?? 'BAAI/bge-small-en-v1.5',
  });
  return toSummary(doc);
}

/**
 * Delete a knowledge base and cascade-delete:
 *   - All KbDocument records for this KB
 *   - All DocumentChunk records for this KB
 *   - The local storage namespace (uploads + extracted folders)
 */
export async function deleteKnowledgeBase(id: string): Promise<boolean> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return false;

  const objectId = new mongoose.Types.ObjectId(id);

  const deleted = await KnowledgeBaseModel.findByIdAndDelete(id);
  if (!deleted) return false;

  // Cascade deletes — run in parallel for speed
  await Promise.all([
    KbDocumentModel.deleteMany({ knowledgeBaseId: objectId }),
    DocumentChunkModel.deleteMany({ knowledgeBaseId: objectId }),
    storageProvider.deleteNamespace(id),
  ]);

  return true;
}

export async function renameKnowledgeBase(
  id: string,
  newName: string
): Promise<KnowledgeBaseSummary | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const doc = await KnowledgeBaseModel.findByIdAndUpdate(
    id,
    { name: newName.trim() },
    { new: true }
  );

  return doc ? toSummary(doc) : null;
}
