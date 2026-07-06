// ============================================================
// ConnectedRepository Model
// Persists connected repositories and their configurations.
// Supports both 'local' and 'github' repository types.
// ============================================================
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IConnectedRepository extends Document {
  id: string; // ← ADD THIS — Mongoose's auto id virtual, needs explicit typing for TS
  name: string;
  type: 'github' | 'local';
  /**
   * Config holds provider-specific parameters:
   * - local: { localPath: string }
   * - github: { owner: string, repo: string }
   */
  config: Record<string, string>;
  owner?: string;
  description?: string;
  defaultBranch?: string;
  primaryLanguage?: string;
  stars?: number;
  lastUpdated?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectedRepositorySchema = new Schema<IConnectedRepository>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['github', 'local'],
    },
    config: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    owner: { type: String },
    description: { type: String },
    defaultBranch: { type: String },
    primaryLanguage: { type: String },
    stars: { type: Number },
    lastUpdated: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ConnectedRepositorySchema.index({ type: 1 });
ConnectedRepositorySchema.index({ name: 1 });

export const ConnectedRepositoryModel: Model<IConnectedRepository> =
  mongoose.models.ConnectedRepository ??
  mongoose.model<IConnectedRepository>('ConnectedRepository', ConnectedRepositorySchema);
