import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWhatsappSession extends Document {
  phoneNumber: string;
  conversationId: string | null;
  activeRepositoryId: string | null;
  preferredModel?: string | null;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsappSessionSchema = new Schema<IWhatsappSession>(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    conversationId: {
      type: String,
      default: null,
    },
    activeRepositoryId: {
      type: String,
      default: null,
    },
    preferredModel: {
      type: String,
      default: null,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const WhatsappSessionModel: Model<IWhatsappSession> =
  mongoose.models.WhatsappSession ??
  mongoose.model<IWhatsappSession>('WhatsappSession', WhatsappSessionSchema);
