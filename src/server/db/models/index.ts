// Barrel export — import models from '@/server/db/models'
export { ConversationModel } from './Conversation';
export { MessageModel } from './Message';
export { ConnectedRepositoryModel } from './ConnectedRepository';
export { WhatsappSessionModel } from './WhatsappSession';
export { KnowledgeBaseModel } from './KnowledgeBase';
export { KbDocumentModel } from './KbDocument';
export { DocumentChunkModel } from './DocumentChunk';
export type { IConversation } from './Conversation';
export type { IMessage, MessageRole, MessageType, MessageStatus } from './Message';
export type { IConnectedRepository } from './ConnectedRepository';
export type { IWhatsappSession } from './WhatsappSession';
export type { IKnowledgeBase } from './KnowledgeBase';
export type { IKbDocument, DocumentStatus, DocumentFileType } from './KbDocument';
export type { IDocumentChunk } from './DocumentChunk';
