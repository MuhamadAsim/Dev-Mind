// ============================================================
// KnowledgeBase Model
// Stores knowledge base metadata.
// Documents live in a separate KbDocument collection.
// Chunks live in a separate DocumentChunk collection.
//
// embeddingModel is persisted here so that if you change
// the default model later, existing KBs retain the model
// they were indexed with — crucial for re-embedding consistency.
// ============================================================
import mongoose, { Schema, Document, Model } from 'mongoose';

// ── TypeScript interface ──────────────────────────────────────

export interface IKnowledgeBase extends Document {
  name: string;
  description?: string;
  /**
   * Embedding model used to vectorise chunks for this KB.
   * Not used in Phase 8 (no embeddings yet), but stored so
   * the model choice travels with the KB into future phases.
   * Default: "BAAI/bge-small-en-v1.5"
   */
  embeddingModel: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ────────────────────────────────────────────────────

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    embeddingModel: {
      type: String,
      default: 'BAAI/bge-small-en-v1.5',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

KnowledgeBaseSchema.index({ updatedAt: -1 });
KnowledgeBaseSchema.index({ name: 1 });

// ── Model ─────────────────────────────────────────────────────

export const KnowledgeBaseModel: Model<IKnowledgeBase> =
  mongoose.models.KnowledgeBase ??
  mongoose.model<IKnowledgeBase>('KnowledgeBase', KnowledgeBaseSchema);
