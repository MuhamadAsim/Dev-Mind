import {
  createConversation,
  getConversation,
  setConversationPendingWrite,
  getConversationPendingWrite,
} from '../db/conversationService';
import { addMessage, updateMessageContent, type MessageDTO } from '../db/messageService';
import { writeRepositoryFile, createRepositoryDirectory } from '../repos/repositoryService';
import { streamChat } from '../ai/aiService';
import { routeContext } from '../orchestration/contextRouter';
import { buildContext } from '../orchestration/contextBuilder';
import { determineResponseMode } from '../voice/voiceService';
import type { RouterInput } from '../orchestration/types';
import type { ChatSessionContext, StartChatTurnResult } from './types';
import type { ChatStreamPart, ChatSession } from '../ai/types';

function detectConfirmation(message: string): 'confirm' | 'reject' | 'unclear' {
  const m = message.trim().toLowerCase().replace(/[.!]+$/, '');
  const confirmPhrases = [
    'yes',
    'y',
    'confirm',
    'do it',
    'proceed',
    'go ahead',
    'approved',
    'ok',
    'okay',
    'sure',
    'yes please',
  ];
  const rejectPhrases = [
    'no',
    'n',
    'cancel',
    'stop',
    'nevermind',
    "don't",
    'do not',
    'reject',
    'no thanks',
  ];
  if (confirmPhrases.includes(m)) return 'confirm';
  if (rejectPhrases.includes(m)) return 'reject';
  return 'unclear';
}

function createPlainStream(text: string): ReadableStream<ChatStreamPart> {
  return new ReadableStream<ChatStreamPart>({
    start(controller) {
      controller.enqueue({ type: 'text', text });
      controller.close();
    },
  });
}

export async function startChatTurn(
  context: ChatSessionContext,
  userMessage: string
): Promise<StartChatTurnResult> {
  const { activeRepositoryId, model } = context;
  let { conversationId } = context;

  const trimmedMessage = userMessage.trim();

  // 1. Create or load conversation
  if (!conversationId) {
    const title =
      trimmedMessage.length <= 60
        ? trimmedMessage
        : trimmedMessage.slice(0, 57) + '…';
    const conv = await createConversation(title, model);
    conversationId = conv.id;
  } else {
    const existing = await getConversation(conversationId);
    if (!existing) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
  }

  // 2. Add user message
  await addMessage(conversationId, 'user', trimmedMessage);

  // 3. Check for pending write confirmation
  const pendingWrite = await getConversationPendingWrite(conversationId);
  if (pendingWrite) {
    const decision = detectConfirmation(trimmedMessage);

    if (decision === 'confirm') {
      let resultText: string;
      try {
        if (pendingWrite.action === 'writeFile') {
          await writeRepositoryFile(
            pendingWrite.repoId,
            pendingWrite.path,
            pendingWrite.content ?? '',
            pendingWrite.commitMessage
          );
          resultText = `✅ Wrote \`${pendingWrite.path}\` to **${pendingWrite.repoName}**.`;
        } else {
          await createRepositoryDirectory(pendingWrite.repoId, pendingWrite.path);
          resultText = `✅ Created directory \`${pendingWrite.path}\` in **${pendingWrite.repoName}**.`;
        }
      } catch (err: any) {
        resultText = `❌ Failed to apply the change: ${err.message || String(err)}`;
      }

      await setConversationPendingWrite(conversationId, null);

      const assistantMsgRecord = await addMessage(conversationId, 'assistant', 'Thinking...', {
        status: 'sending',
      });

      const session: ChatSession = {
        activeRepoId: activeRepositoryId,
        pendingWrite: null,
      };

      const finalize = async (fullText: string) => {
        await updateMessageContent(assistantMsgRecord.id, fullText, 'sent');
        return {
          id: assistantMsgRecord.id,
          conversationId: conversationId!,
          role: 'assistant',
          content: fullText,
          type: 'text',
          status: 'sent',
          createdAt: new Date().toISOString(),
          metadata: {},
        } as MessageDTO;
      };

      return {
        conversationId,
        assistantMessageId: assistantMsgRecord.id,
        stream: createPlainStream(resultText),
        session,
        finalize,
        responseMode: 'text',
      };
    }

    if (decision === 'reject') {
      await setConversationPendingWrite(conversationId, null);
      const cancelText = `Cancelled — no changes were made to \`${pendingWrite.path}\`.`;

      const assistantMsgRecord = await addMessage(conversationId, 'assistant', 'Thinking...', {
        status: 'sending',
      });

      const session: ChatSession = {
        activeRepoId: activeRepositoryId,
        pendingWrite: null,
      };

      const finalize = async (fullText: string) => {
        await updateMessageContent(assistantMsgRecord.id, fullText, 'sent');
        return {
          id: assistantMsgRecord.id,
          conversationId: conversationId!,
          role: 'assistant',
          content: fullText,
          type: 'text',
          status: 'sent',
          createdAt: new Date().toISOString(),
          metadata: {},
        } as MessageDTO;
      };

      return {
        conversationId,
        assistantMessageId: assistantMsgRecord.id,
        stream: createPlainStream(cancelText),
        session,
        finalize,
        responseMode: 'text',
      };
    }
  }

  // 4. Normal LLM Turn — context orchestration
  // Route to the appropriate context providers, then build the
  // assembled context (conversation history + system context block).
  const routerInput: RouterInput = {
    userMessage: trimmedMessage,
    activeRepositoryId,
    conversationId,
  };

  const selectedProviders = await routeContext(routerInput);
  const assembledContext = await buildContext(selectedProviders, routerInput);

  // Determine response mode (text, voice, or both)
  const conversationHasKnowledge = (assembledContext.conversationMessages ?? []).some(m =>
    typeof m.content === 'string' &&
    /\b(knowledge\s*base|kb|document|pdf|cv|resume|muhammad_asim|asim)\b/i.test(m.content)
  );

  const responseMode = determineResponseMode({
    userMessage: trimmedMessage,
    activeRepositoryId,
    selectedProviders,
    hasKnowledgeContext: assembledContext.providers.includes('knowledge') || conversationHasKnowledge,
    conversationHasKnowledge,
  });

  const assistantMsgRecord = await addMessage(conversationId, 'assistant', 'Thinking...', {
    status: 'sending',
  });

  const { stream, session } = await streamChat({
    userMessage: trimmedMessage,
    model,
    activeRepoId: activeRepositoryId,
    assembledContext,
    responseMode,
  });

  const finalize = async (fullText: string) => {
    await updateMessageContent(
      assistantMsgRecord.id,
      fullText || '[No response]',
      fullText ? 'sent' : 'error'
    );
    if (session.pendingWrite) {
      await setConversationPendingWrite(conversationId!, session.pendingWrite);
    }
    return {
      id: assistantMsgRecord.id,
      conversationId: conversationId!,
      role: 'assistant',
      content: fullText || '[No response]',
      type: 'text',
      status: fullText ? 'sent' : 'error',
      createdAt: new Date().toISOString(),
      metadata: {},
    } as MessageDTO;
  };

  return {
    conversationId,
    assistantMessageId: assistantMsgRecord.id,
    stream,
    session,
    finalize,
    responseMode,
  };
}

