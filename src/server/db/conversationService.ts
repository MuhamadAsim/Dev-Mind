// ============================================================
// Conversation Service
// ============================================================
import { connectDB } from './mongoose';
import { ConversationModel, IConversation } from './models';
import mongoose from 'mongoose';
import type { PendingWrite } from '../ai/types';

export interface ConversationSummary {
  id: string;
  title: string;
  aiModel: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

function toSummary(doc: IConversation): ConversationSummary {
  return {
    id: (doc._id as mongoose.Types.ObjectId).toString(),
    title: doc.title,
    aiModel: doc.aiModel,
    isPinned: doc.isPinned ?? false,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    metadata: doc.metadata ?? {},
  };
}

export async function listConversations(): Promise<ConversationSummary[]> {
  await connectDB();
  const docs = await ConversationModel.find({}).sort({ updatedAt: -1 }).lean<IConversation[]>();
  return docs.map(toSummary);
}

export async function getConversation(id: string): Promise<ConversationSummary | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await ConversationModel.findById(id).lean<IConversation>();
  return doc ? toSummary(doc) : null;
}

export async function createConversation(
  title: string,
  aiModel?: string,
  metadata?: Record<string, unknown>
): Promise<ConversationSummary> {
  await connectDB();
  const doc = await ConversationModel.create({
    title,
    aiModel: aiModel ?? process.env.DEFAULT_AI_MODEL ?? 'openai/gpt-4o-mini',
    metadata: metadata ?? {},
  });
  return toSummary(doc);
}

export async function renameConversation(
  id: string,
  title: string
): Promise<ConversationSummary | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await ConversationModel.findByIdAndUpdate(
    id,
    { title: title.trim() },
    { new: true }
  ).lean<IConversation>();
  return doc ? toSummary(doc) : null;
}

export async function setConversationPinned(
  id: string,
  isPinned: boolean
): Promise<ConversationSummary | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await ConversationModel.findByIdAndUpdate(
    id,
    { isPinned },
    { new: true }
  ).lean<IConversation>();
  return doc ? toSummary(doc) : null;
}

export async function deleteConversation(id: string): Promise<boolean> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  const result = await ConversationModel.findByIdAndDelete(id);
  return result !== null;
}

export async function touchConversation(id: string): Promise<void> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await ConversationModel.findByIdAndUpdate(id, { updatedAt: new Date() });
}

// ── NEW: pending write confirmation gate storage ──────────────

/**
 * Persist (or clear, with null) a staged file write/directory creation
 * on this conversation. Stored inside `metadata` rather than as a top-level
 * schema field, so no Mongoose schema migration is needed.
 */
export async function setConversationPendingWrite(
  id: string,
  pendingWrite: PendingWrite | null
): Promise<void> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await ConversationModel.findByIdAndUpdate(id, {
    $set: { 'metadata.pendingWrite': pendingWrite },
  });
}

/** Read the currently staged write for this conversation, if any. */
export async function getConversationPendingWrite(id: string): Promise<PendingWrite | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await ConversationModel.findById(id).lean<IConversation>();
  const metadata = doc?.metadata as Record<string, unknown> | undefined;
  return (metadata?.pendingWrite as PendingWrite | undefined) ?? null;
}