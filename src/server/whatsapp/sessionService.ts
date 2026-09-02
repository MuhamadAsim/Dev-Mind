import { connectDB } from '../db/mongoose';
import { WhatsappSessionModel } from '../db/models/WhatsappSession';
import type { IWhatsappSession } from '../db/models/WhatsappSession';

export async function getOrCreateSession(phoneNumber: string): Promise<IWhatsappSession> {
  await connectDB();
  
  let session = await WhatsappSessionModel.findOne({ phoneNumber });
  if (!session) {
    session = new WhatsappSessionModel({
      phoneNumber,
      conversationId: null,
      activeRepositoryId: null,
      preferredModel: null,
    });
  }
  
  session.lastSeen = new Date();
  await session.save();
  return session;
}

export async function updateSessionConversation(
  phoneNumber: string,
  conversationId: string | null
): Promise<IWhatsappSession | null> {
  await connectDB();
  return WhatsappSessionModel.findOneAndUpdate(
    { phoneNumber },
    { conversationId, lastSeen: new Date() },
    { new: true }
  );
}

export async function updateSessionRepository(
  phoneNumber: string,
  activeRepositoryId: string | null
): Promise<IWhatsappSession | null> {
  await connectDB();
  return WhatsappSessionModel.findOneAndUpdate(
    { phoneNumber },
    { activeRepositoryId, lastSeen: new Date() },
    { new: true }
  );
}


export interface PendingUpload {
  filename: string;
  mimetype: string;
  dataBase64: string;
  uploadedAt: Date;
}

export async function setPendingUpload(
  phoneNumber: string,
  pendingUpload: PendingUpload
): Promise<IWhatsappSession | null> {
  await connectDB();
  return WhatsappSessionModel.findOneAndUpdate(
    { phoneNumber },
    { pendingUpload, lastSeen: new Date() },
    { new: true }
  );
}

export async function clearPendingUpload(
  phoneNumber: string
): Promise<IWhatsappSession | null> {
  await connectDB();
  return WhatsappSessionModel.findOneAndUpdate(
    { phoneNumber },
    { pendingUpload: null, lastSeen: new Date() },
    { new: true }
  );
}