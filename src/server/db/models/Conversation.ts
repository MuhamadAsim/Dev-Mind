// ============================================================
// Conversation Model
// Stores conversation-level metadata only.
// Messages live in a separate Message collection (see Message.ts).
// Designed to grow with future fields (RAG, MCP, agents, repos)
// without schema redesign — all extensible via `metadata`.
// ============================================================
import mongoose, { Schema, Document, Model } from 'mongoose';

// ── TypeScript interface ──────────────────────────────────────
// Note: We use `aiModel` (not `model`) to avoid conflicting with
// Mongoose Document's built-in `model()` function property.

export interface IConversation extends Document {
  title: string;
  /** AI model used, e.g. 'openai/gpt-4o-mini' */
  aiModel: string;
  createdAt: Date;
  isPinned: boolean;   // ← add
  updatedAt: Date;
  /**
   * Flexible bag for future metadata:
   * - repository, workspace
   * - ragContext, vectorStoreId
   * - mcpMetadata, agentMetadata
   * - tags, isPinned, etc.
   */
  metadata: Record<string, unknown>;
}

// ── Schema ────────────────────────────────────────────────────

const ConversationSchema = new Schema<IConversation>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'New conversation',
    },
    aiModel: {
      type: String,
      default: process.env.DEFAULT_AI_MODEL ?? 'openai/gpt-4o-mini',
    },
    isPinned: { type: Boolean, default: false },   // ← add


    // Open-ended metadata bag — no rigid schema so future phases
    // can add repository, RAG context, MCP metadata, agent state, etc.
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    // Mongoose auto-manages createdAt and updatedAt
    timestamps: true,
    // Optimize _id serialization to string
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for listing conversations sorted by most recently updated
ConversationSchema.index({ updatedAt: -1 });

// ── Model ─────────────────────────────────────────────────────

// Guard against model re-registration during Next.js hot reloads
export const ConversationModel: Model<IConversation> =
  mongoose.models.Conversation ??
  mongoose.model<IConversation>('Conversation', ConversationSchema);
