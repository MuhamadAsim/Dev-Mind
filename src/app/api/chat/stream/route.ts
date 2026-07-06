// ============================================================
// POST /api/chat/stream
//
// Flow (extended with write-confirmation gate):
//   1. Save user message to DB
//   2. If this conversation has a PENDING write proposal:
//        - "yes"/"confirm" → actually perform the write, in plain server
//          code (NOT an LLM call), clear the pending state, respond.
//        - "no"/"cancel"   → discard it, respond, no LLM call.
//        - anything else   → fall through to the normal LLM turn so it
//          can re-ask; pending state is left untouched.
//   3. Otherwise: normal LLM turn. If the LLM staged a NEW proposal this
//      turn (session.pendingWrite), persist it for the next message.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { streamChat } from '@/server/ai/aiService';
import {
  createConversation,
  getConversation,
  setConversationPendingWrite,
  getConversationPendingWrite,
} from '@/server/db/conversationService';
import { addMessage, getMessages, updateMessageContent } from '@/server/db/messageService';
import { writeRepositoryFile, createRepositoryDirectory } from '@/server/repos/repositoryService';
import type { AIMessage } from '@/server/ai/types';

export const runtime = 'nodejs';

/**
 * Deterministic yes/no detection for the confirmation gate.
 * Intentionally simple keyword matching, NOT an LLM call — the whole point
 * of this gate is that it doesn't depend on model judgment. Extend these
 * lists as you notice real phrasings you use that don't match yet.
 */
function detectConfirmation(message: string): 'confirm' | 'reject' | 'unclear' {
  const m = message.trim().toLowerCase().replace(/[.!]+$/, '');
  const confirmPhrases = ['yes', 'y', 'confirm', 'do it', 'proceed', 'go ahead', 'approved', 'ok', 'okay', 'sure', 'yes please'];
  const rejectPhrases = ['no', 'n', 'cancel', 'stop', 'nevermind', "don't", 'do not', 'reject', 'no thanks'];
  if (confirmPhrases.includes(m)) return 'confirm';
  if (rejectPhrases.includes(m)) return 'reject';
  return 'unclear';
}

/** Emits a single pre-written assistant message as an SSE stream, reusing
 *  the exact same event shape (meta/chunk/done) the client already parses —
 *  no ChatInterface.tsx changes needed for the confirm/cancel responses. */
function streamPlainMessage(conversationId: string, assistantMessageId: string, text: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      const meta = JSON.stringify({ type: 'meta', conversationId, assistantMessageId });
      controller.enqueue(new TextEncoder().encode(`data: ${meta}\n\n`));
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`));
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      conversationId?: string | null;
      message: string;
      model?: string;
      activeRepoId?: string | null;
    };

    const { message, model, activeRepoId } = body;
    let { conversationId } = body;
    const initialActiveRepoId = activeRepoId ?? null;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    // ── Ensure conversation exists ─────────────────────────────
    if (!conversationId) {
      const title = message.trim().length <= 60 ? message.trim() : message.trim().slice(0, 57) + '…';
      const conv = await createConversation(title, model);
      conversationId = conv.id;
    } else {
      const existing = await getConversation(conversationId);
      if (!existing) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
      }
    }

    // ── Save user message ──────────────────────────────────────
    await addMessage(conversationId, 'user', message.trim());

    // ── Write-confirmation gate ─────────────────────────────────
    // A brand-new conversation can never have a pending write, but a
    // pre-existing one might — check before doing anything else.
    const pendingWrite = await getConversationPendingWrite(conversationId);

    if (pendingWrite) {
      const decision = detectConfirmation(message);

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
        const assistantMsg = await addMessage(conversationId, 'assistant', resultText, { status: 'sent' });
        return streamPlainMessage(conversationId, assistantMsg.id, resultText);
      }

      if (decision === 'reject') {
        await setConversationPendingWrite(conversationId, null);
        const cancelText = `Cancelled — no changes were made to \`${pendingWrite.path}\`.`;
        const assistantMsg = await addMessage(conversationId, 'assistant', cancelText, { status: 'sent' });
        return streamPlainMessage(conversationId, assistantMsg.id, cancelText);
      }

      // decision === 'unclear' → fall through to the normal LLM turn below
      // so it can re-ask for clarification. pendingWrite stays as-is.
    }

    // ── Normal LLM turn ──────────────────────────────────────────
    const history = await getMessages(conversationId);
    const aiMessages: AIMessage[] = history.map((m) => ({
      role: m.role as AIMessage['role'],
      content: m.content,
    }));

    const assistantMsgRecord = await addMessage(conversationId, 'assistant', 'Thinking...', {
      status: 'sending',
    });

    const { stream: textStream, session } = await streamChat({
      messages: aiMessages,
      model,
      activeRepoId: initialActiveRepoId,
    });

    let fullContent = '';

    const responseStream = new ReadableStream({
      async start(controller) {
        const meta = JSON.stringify({
          type: 'meta',
          conversationId,
          assistantMessageId: assistantMsgRecord.id,
        });
        controller.enqueue(new TextEncoder().encode(`data: ${meta}\n\n`));

        const reader = textStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullContent += value;
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ type: 'chunk', text: value })}\n\n`)
            );
          }

          // Existing repo-context sync (selectRepo/disconnectRepo mid-turn)
          if (session.activeRepoId !== initialActiveRepoId) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'repoContext', activeRepoId: session.activeRepoId })}\n\n`
              )
            );
          }

          // NEW: if the LLM staged a write proposal this turn, persist it —
          // the NEXT user message will be checked against it above.
          if (session.pendingWrite) {
            await setConversationPendingWrite(conversationId, session.pendingWrite);
          }

          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (err) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted.' })}\n\n`
            )
          );
          controller.close();
          throw err;
        } finally {
          reader.releaseLock();
          await updateMessageContent(
            assistantMsgRecord.id,
            fullContent || '[No response]',
            fullContent ? 'sent' : 'error'
          );
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[/api/chat/stream] Error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}