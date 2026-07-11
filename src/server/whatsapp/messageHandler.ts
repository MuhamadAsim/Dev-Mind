import type { Message } from 'whatsapp-web.js';
import { startChatTurn } from '../chat/chatOrchestrator';
import type { ChatSessionContext } from '../chat/types';
import {
  getOrCreateSession,
  updateSessionConversation,
  updateSessionRepository,
} from './sessionService';
import { handleCommand } from './commandHandler';
import { formatForWhatsApp, chunkMessage } from './formatting';

// Parse allowed numbers from environment variables
const allowedRaw = process.env.WHATSAPP_ALLOWED_NUMBERS || '';
const allowedNumbers = allowedRaw
  .split(',')
  .map((num) => num.replace(/\D/g, ''))
  .filter(Boolean);

console.log("Allowed Raw:", process.env.WHATSAPP_ALLOWED_NUMBERS);
console.log("Allowed Numbers:", allowedNumbers);

// Log warnings at load time if allowed numbers are not configured
if (allowedNumbers.length === 0) {
  console.warn(
    '[WhatsApp] WARNING: WHATSAPP_ALLOWED_NUMBERS is empty or unset. WhatsApp client will ignore all incoming messages.'
  );
}

// Map to handle sequential queue/lock per phone number
const locks = new Map<string, Promise<unknown>>();

async function acquireLock(phoneNumber: string, fn: () => Promise<void>): Promise<void> {
  const existing = locks.get(phoneNumber) || Promise.resolve();
  const next = (async () => {
    try {
      await existing;
    } catch (err) {
      // Ignore errors from previous turns in the queue to avoid blocking subsequent messages
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

  // Log incoming message metadata and content (authorized numbers only)
  console.log(`[WhatsApp] Incoming Message from ${phoneNumber}: ${message.body}`);

  // 3. Gracefully reject non-text messages
  if (message.type !== 'chat') {
    await message.reply('I can only read text messages for now.');
    return;
  }

  // 4. Load or create user session
  const session = await getOrCreateSession(phoneNumber);

  // 5. Check if it is a slash command
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

  // 6. Queue/Lock the message turn to handle consecutively
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

      // Call ChatOrchestrator to start the turn
      const {
        conversationId: resolvedConvId,
        stream,
        session: chatSession,
        finalize,
      } = await startChatTurn(context, message.body);

      // Persist the conversation ID back to the WhatsApp session if it was newly created
      if (!session.conversationId) {
        session.conversationId = resolvedConvId;
        await updateSessionConversation(phoneNumber, resolvedConvId);
      }

      // Buffer the AI stream (WhatsApp is a buffered client)
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

      // Finalize the turn to save the assistant message to the DB
      await finalize(fullContent);

      // Check if activeRepoId was changed during the turn by a tool call
      if (chatSession.activeRepoId !== session.activeRepositoryId) {
        session.activeRepositoryId = chatSession.activeRepoId;
        await updateSessionRepository(phoneNumber, chatSession.activeRepoId);
        console.log(`[WhatsApp] Repository switched mid-turn to: ${chatSession.activeRepoId}`);
      }

      // Format response for WhatsApp
      let replyText = formatForWhatsApp(fullContent);

      // Append warning if no repository context is selected
      if (!session.activeRepositoryId) {
        replyText +=
          '\n\nNo repository selected — run /repos and /repo <name> to enable codebase context.';
      }

      // Split responses if it exceeds limit
      const maxMsgLen = process.env.WHATSAPP_MAX_MESSAGE_LENGTH
        ? parseInt(process.env.WHATSAPP_MAX_MESSAGE_LENGTH, 10)
        : 3500;

      const replyChunks = chunkMessage(replyText, maxMsgLen);

      // Send the sequential chunks in order
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
