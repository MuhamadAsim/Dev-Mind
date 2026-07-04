// ============================================================
// Message Model — separate collection (not embedded in Conversation)
//
// Using a separate collection rather than embedding gives us:
//   - Efficient pagination for long conversations
//   - Independent indexing (role, type, createdAt)
//   - Granular updates without rewriting the whole conversation doc
//   - Room for future tool-call results, RAG citations, MCP outputs
//   - Scalable to thousands of messages per conversation
// ============================================================
import mongoose, { Schema, Document, Model } from 'mongoose';

// ── Types ─────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message type — extensible for future content modalities:
 * 'text'       — plain chat message (default)
 * 'tool_call'  — LangGraph/MCP tool invocation (future)
 * 'tool_result'— result returned from a tool (future)
 * 'image'      — multimodal image input/output (future)
 * 'code'       — standalone code block (future)
 */
export type MessageType = 'text' | 'tool_call' | 'tool_result' | 'image' | 'code';

export type MessageStatus = 'sending' | 'sent' | 'error';

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  role: MessageRole;
  content: string;
  type: MessageType;
  status: MessageStatus;
  createdAt: Date;
  /**
   * Flexible metadata bag for future extensions:
   * - RAG citations / source chunks
   * - Tool call name + arguments (MCP / LangGraph)
   * - Token usage, model name, finish reason
   * - Agent step index, plan reference
   */
  metadata: Record<string, unknown>;
}

// ── Schema ────────────────────────────────────────────────────

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true, // fast lookup of all messages for a conversation
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'] satisfies MessageRole[],
      required: true,
    },
    content: {
      type: String,
      required: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['text', 'tool_call', 'tool_result', 'image', 'code'] satisfies MessageType[],
      default: 'text',
    },
    status: {
      type: String,
      enum: ['sending', 'sent', 'error'] satisfies MessageStatus[],
      default: 'sent',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    // Only createdAt is managed — messages are immutable once created
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index: fetch all messages for a conversation sorted by time
MessageSchema.index({ conversationId: 1, createdAt: 1 });

// ── Model ─────────────────────────────────────────────────────

export const MessageModel: Model<IMessage> =
  mongoose.models.Message ??
  mongoose.model<IMessage>('Message', MessageSchema);
