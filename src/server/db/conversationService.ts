// ============================================================
// Conversation Service
// All conversation-level DB operations live here.
// API routes and other services call these functions —
// Mongoose queries never escape this file.
// ============================================================
import { connectDB } from './mongoose';
import { ConversationModel, IConversation } from './models';
import mongoose from 'mongoose';

// ── Serializable shape returned to the client ─────────────────
// We never return Mongoose Documents directly — always plain objects.
export interface ConversationSummary {
  id: string;
  title: string;
  /** AI model identifier, e.g. 'openai/gpt-4o-mini' */
  aiModel: string;
  isPinned: boolean;   // ← add
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────

function toSummary(doc: IConversation): ConversationSummary {
  return {
    id: (doc._id as mongoose.Types.ObjectId).toString(),
    title: doc.title,
    aiModel: doc.aiModel,
    isPinned: doc.isPinned ?? false,   // ← add
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    metadata: doc.metadata ?? {},
  };
}

// ── Service functions ─────────────────────────────────────────

/**
 * List all conversations, most-recently-updated first.
 * Returns summary only (no messages — those are fetched separately).
 */
export async function listConversations(): Promise<ConversationSummary[]> {
  await connectDB();
  const docs = await ConversationModel.find({}).sort({ updatedAt: -1 }).lean<IConversation[]>();
  return docs.map(toSummary);
}

/**
 * Get a single conversation's metadata.
 * Returns null if not found.
 */
export async function getConversation(id: string): Promise<ConversationSummary | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await ConversationModel.findById(id).lean<IConversation>();
  return doc ? toSummary(doc) : null;
}

/**
 * Create a new conversation.
 */
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

/**
 * Rename a conversation. Returns the updated summary or null if not found.
 */
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




/**
 * Pin or unpin a conversation. Returns the updated summary or null if not found.
 */
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

/**
 * Delete a conversation. Caller is responsible for also deleting its messages
 * (see messageService.deleteMessagesByConversation).
 */
export async function deleteConversation(id: string): Promise<boolean> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  const result = await ConversationModel.findByIdAndDelete(id);
  return result !== null;
}

/**
 * Bump the updatedAt timestamp — called whenever a new message is added.
 */
export async function touchConversation(id: string): Promise<void> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await ConversationModel.findByIdAndUpdate(id, { updatedAt: new Date() });
}
