// ============================================================
// Message Service
// All message-level DB operations live here.
// Messages and conversations are in separate collections —
// queries here only touch the Message collection.
// ============================================================
import { connectDB } from './mongoose';
import { MessageModel, IMessage, MessageRole, MessageType, MessageStatus } from './models';
import { touchConversation } from './conversationService';
import mongoose from 'mongoose';

// ── Serializable shape returned to the client ─────────────────

export interface MessageDTO {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  type: MessageType;
  status: MessageStatus;
  createdAt: string;
  metadata: Record<string, unknown>;
}

// ── Helper ────────────────────────────────────────────────────

function toDTO(doc: IMessage): MessageDTO {
  return {
    id: (doc._id as mongoose.Types.ObjectId).toString(),
    conversationId: doc.conversationId.toString(),
    role: doc.role,
    content: doc.content,
    type: doc.type,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    metadata: doc.metadata ?? {},
  };
}

// ── Service functions ─────────────────────────────────────────

/**
 * Fetch all messages for a conversation, ordered chronologically.
 */
export async function getMessages(conversationId: string): Promise<MessageDTO[]> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return [];
  const docs = await MessageModel.find({ conversationId })
    .sort({ createdAt: 1 })
    .lean<IMessage[]>();
  return docs.map(toDTO);
}

/**
 * Add a single message to a conversation.
 * Also bumps the conversation's updatedAt timestamp.
 */
export async function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  options?: {
    type?: MessageType;
    status?: MessageStatus;
    metadata?: Record<string, unknown>;
  }
): Promise<MessageDTO> {
  await connectDB();

  const doc = await MessageModel.create({
    conversationId: new mongoose.Types.ObjectId(conversationId),
    role,
    content,
    type: options?.type ?? 'text',
    status: options?.status ?? 'sent',
    metadata: options?.metadata ?? {},
  });

  // Keep conversation's updatedAt in sync — runs in background
  touchConversation(conversationId).catch(console.error);

  return toDTO(doc);
}

/**
 * Update the content of an existing message (e.g., after streaming completes).
 */
export async function updateMessageContent(
  messageId: string,
  content: string,
  status: MessageStatus = 'sent'
): Promise<void> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(messageId)) return;
  await MessageModel.findByIdAndUpdate(messageId, { content, status });
}

/**
 * Delete all messages belonging to a conversation.
 * Call this when deleting a conversation to avoid orphaned messages.
 */
export async function deleteMessagesByConversation(conversationId: string): Promise<void> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
  await MessageModel.deleteMany({ conversationId });
}
