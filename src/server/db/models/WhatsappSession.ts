import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWhatsappSession extends Document {
  phoneNumber: string;
  conversationId: string | null;
  activeRepositoryId: string | null;
  preferredModel?: string | null;
  pendingUpload: {
    filename: string;
    mimetype: string;
    dataBase64: string;
    uploadedAt: Date;
  } | null;
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
    pendingUpload: {
      type: {
        filename: String,
        mimetype: String,
        dataBase64: String,
        uploadedAt: Date,
      },
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
