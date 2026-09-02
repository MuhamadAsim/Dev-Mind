import type { Message } from 'whatsapp-web.js';
import { startChatTurn } from '../chat/chatOrchestrator';
import type { ChatSessionContext } from '../chat/types';
import {
  getOrCreateSession,
  updateSessionConversation,
  updateSessionRepository,
  setPendingUpload,
  clearPendingUpload,
} from './sessionService';
import { handleCommand } from './commandHandler';
import { formatForWhatsApp, chunkMessage } from './formatting';
import { processUpload } from '../knowledge/uploadService';
import { listKnowledgeBases } from '../knowledge/knowledgeBaseService';
import { SUPPORTED_MIME_TYPES } from '../knowledge/types';

// Parse allowed numbers from environment variables
const allowedRaw = process.env.WHATSAPP_ALLOWED_NUMBERS || '';
const allowedNumbers = allowedRaw
  .split(',')
  .map((num) => num.replace(/\D/g, ''))
  .filter(Boolean);

console.log("Allowed Raw:", process.env.WHATSAPP_ALLOWED_NUMBERS);
console.log("Allowed Numbers:", allowedNumbers);

if (allowedNumbers.length === 0) {
  console.warn(
    '[WhatsApp] WARNING: WHATSAPP_ALLOWED_NUMBERS is empty or unset. WhatsApp client will ignore all incoming messages.'
  );
}

const locks = new Map<string, Promise<unknown>>();

async function acquireLock(phoneNumber: string, fn: () => Promise<void>): Promise<void> {
  const existing = locks.get(phoneNumber) || Promise.resolve();
  const next = (async () => {
    try {
      await existing;
    } catch (err) {
      console.error('[WhatsApp] Previous task error in lock queue:', err);
    }
    await fn();
  })();
  locks.set(phoneNumber, next);
  return next as Promise<void>;
}

export async function handleIncomingMessage(message: Message): Promise<void> {
  // 1. Ignore messages from group chats
  if (message.from.endsWith('@g.us')) {
    return;
  }

  // 2. Extract phone number and verify authorization
  const phoneNumber = message.from.split('@')[0];

  if (allowedNumbers.length === 0) {
    console.warn(
      `[WhatsApp] Unauthorized attempt from ${phoneNumber}: WHATSAPP_ALLOWED_NUMBERS is not configured.`
    );
    return;
  }

  if (!allowedNumbers.includes(phoneNumber)) {
    console.log(`[WhatsApp] Unauthorized message attempt from phone: ${phoneNumber}`);
    return;
  }

  console.log(`[WhatsApp] Incoming Message from ${phoneNumber}: ${message.body}`);

  // 3. Load or create user session (moved up — needed before we can decide
  //    whether this message is a KB-name answer to a pending upload)
  const session = await getOrCreateSession(phoneNumber);

  // 4. If a document upload is awaiting a KB name, this message resolves it
  //    — regardless of the message type check below.
  if (session.pendingUpload) {
    if (message.type !== 'chat') {
      await message.reply(
        `I'm still waiting for you to tell me which Knowledge Base to upload "${session.pendingUpload.filename}" to. Reply with a KB name, or "cancel".`
      );
      return;
    }

    const answer = message.body.trim();

    if (answer.toLowerCase() === 'cancel') {
      await clearPendingUpload(phoneNumber);
      await message.reply(`Cancelled. "${session.pendingUpload.filename}" was not uploaded.`);
      return;
    }

    try {
      const kbs = await listKnowledgeBases();
      const match =
        kbs.find((kb) => kb.name.toLowerCase() === answer.toLowerCase()) ??
        kbs.find((kb) => kb.name.toLowerCase().includes(answer.toLowerCase()));

      if (!match) {
        const kbList =
          kbs.length > 0
            ? kbs.map((kb) => `- ${kb.name}`).join('\n')
            : '(none yet — create one on the Web UI first)';
        await message.reply(
          `No Knowledge Base matches "${answer}". Available:\n${kbList}\n\nReply with a valid name, or "cancel".`
        );
        return; // pendingUpload stays intact — ask again next message
      }

      const buffer = Buffer.from(session.pendingUpload.dataBase64, 'base64');
      await processUpload({
        kbId: match.id,
        filename: session.pendingUpload.filename,
        buffer,
      });

      await clearPendingUpload(phoneNumber);
      await message.reply(
        `Uploading "${session.pendingUpload.filename}" to "${match.name}"... give it a moment to process, then ask me what's in it.`
      );
    } catch (err: any) {
      console.error(`[WhatsApp] Upload resolution failed for ${phoneNumber}:`, err);
      await clearPendingUpload(phoneNumber);
      await message.reply(`Upload failed: ${err.message || String(err)}`);
    }
    return;
  }

  // 5. Handle an incoming document attachment — stage it, then ask which KB
  if (message.hasMedia && message.type === 'document') {
    try {
      const media = await message.downloadMedia();
      if (!media) {
        await message.reply('Could not download that file — please try sending it again.');
        return;
      }

      const filename = media.filename || 'upload';
      const fileType = SUPPORTED_MIME_TYPES[media.mimetype];

      if (!fileType) {
        await message.reply(
          `Unsupported file type ("${media.mimetype}"). I can only accept PDF, DOCX, TXT, and MD files.`
        );
        return;
      }

      await setPendingUpload(phoneNumber, {
        filename,
        mimetype: media.mimetype,
        dataBase64: media.data,
        uploadedAt: new Date(),
      });

      await message.reply(
        `Got "${filename}". Which Knowledge Base should I add it to? Reply with a name, or "cancel".`
      );
    } catch (err: any) {
      console.error(`[WhatsApp] Document handling failed for ${phoneNumber}:`, err);
      await message.reply(
        `Sorry, something went wrong reading that file: ${err.message || String(err)}`
      );
    }
    return;
  }

  // 6. Gracefully reject other non-text messages (images, stickers, video, etc.)
  if (message.type !== 'chat') {
    await message.reply('I can only read text messages and documents (PDF/DOCX/TXT/MD) for now.');
    return;
  }

  // 7. Slash command?
  if (message.body.startsWith('/')) {
    try {
      const commandReply = await handleCommand(message.body, session);
      await message.reply(commandReply);
    } catch (err: any) {
      console.error(`[WhatsApp] Command handling failed for ${phoneNumber}:`, err);
      await message.reply(`Command failed: ${err.message || String(err)}`);
    }
    return;
  }

  // 8. Queue/lock the AI turn to handle consecutively
  await acquireLock(phoneNumber, async () => {
    try {
      console.log(`[WhatsApp] Processing AI turn for ${phoneNumber}...`);

      const context: ChatSessionContext = {
        clientType: 'whatsapp',
        conversationId: session.conversationId,
        activeRepositoryId: session.activeRepositoryId,
        model: session.preferredModel || undefined,
        metadata: { phoneNumber },
      };

      const {
        conversationId: resolvedConvId,
        stream,
        session: chatSession,
        finalize,
      } = await startChatTurn(context, message.body);

      if (!session.conversationId) {
        session.conversationId = resolvedConvId;
        await updateSessionConversation(phoneNumber, resolvedConvId);
      }

      let fullContent = '';
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value: part } = await reader.read();
          if (done) break;
          if (part.type === 'text') {
            fullContent += part.text;
          }
        }
      } finally {
        reader.releaseLock();
      }

      await finalize(fullContent);

      if (chatSession.activeRepoId !== session.activeRepositoryId) {
        session.activeRepositoryId = chatSession.activeRepoId;
        await updateSessionRepository(phoneNumber, chatSession.activeRepoId);
        console.log(`[WhatsApp] Repository switched mid-turn to: ${chatSession.activeRepoId}`);
      }

      let replyText = formatForWhatsApp(fullContent);

      if (!session.activeRepositoryId) {
        replyText +=
          '\n\nNo repository selected — run /repos and /repo <name> to enable codebase context.';
      }

      const maxMsgLen = process.env.WHATSAPP_MAX_MESSAGE_LENGTH
        ? parseInt(process.env.WHATSAPP_MAX_MESSAGE_LENGTH, 10)
        : 3500;
      console.log("Reply length:", replyText.length);
      console.log("Reply text:");
      console.log(replyText);
      const replyChunks = chunkMessage(replyText, maxMsgLen);
      console.log("Chunks:", replyChunks.length);

      replyChunks.forEach((c, i) => {
        console.log(`Chunk ${i}: (${c.length} chars)`);
        console.log(c);
      });

      for (const chunk of replyChunks) {
        await message.reply(chunk);
      }

      console.log(`[WhatsApp] AI Response sent successfully to ${phoneNumber}`);
    } catch (err: any) {
      console.error(`[WhatsApp] Error in AI turn execution for ${phoneNumber}:`, err);
      await message.reply(
        `Sorry, I encountered an error while processing your request: ${err.message || String(err)}`
      );
    }
  });
}