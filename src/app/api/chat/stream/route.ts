// ============================================================
// POST /api/chat/stream
//
// Request body:
//   { conversationId?: string | null; message: string; model?: string; activeRepoId?: string | null }
//
// Flow:
//   1. Create conversation if needed
//   2. Save user message to DB
//   3. Load full history for context
//   4. Stream AI response back to client (SSE: meta → chunk* → [repoContext] → done)
//   5. Save completed assistant message to DB after stream ends
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { streamChat } from '@/server/ai/aiService';
import {
  createConversation,
  getConversation,
} from '@/server/db/conversationService';
import { addMessage, getMessages, updateMessageContent } from '@/server/db/messageService';
import type { AIMessage } from '@/server/ai/types';

export const runtime = 'nodejs'; // Required for Mongoose + streaming

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      conversationId?: string | null;
      message: string;
      model?: string;
      activeRepoId?: string | null;
    };

    const { message, model, activeRepoId } = body;
    let { conversationId } = body;
    const initialActiveRepoId = activeRepoId ?? null;

    // ── Validate ──────────────────────────────────────────────
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    // ── 1. Ensure conversation exists ─────────────────────────
    if (!conversationId) {
      const title = message.trim().length <= 60
        ? message.trim()
        : message.trim().slice(0, 57) + '…';
      const conv = await createConversation(title, model);
      conversationId = conv.id;
    } else {
      const existing = await getConversation(conversationId);
      if (!existing) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
      }
    }

    // ── 2. Save user message ──────────────────────────────────
    await addMessage(conversationId, 'user', message.trim());

    // ── 3. Load conversation history for context ──────────────
    const history = await getMessages(conversationId);
    const aiMessages: AIMessage[] = history.map((m) => ({
      role: m.role as AIMessage['role'],
      content: m.content,
    }));

    // ── 4. Create placeholder assistant message in DB ─────────
    const assistantMsgRecord = await addMessage(conversationId, 'assistant', 'Thinking...', {
      status: 'sending',
    });

    // ── 5. Stream AI response ─────────────────────────────────
    // NEW: streamChat returns { stream, session } instead of just a stream.
    // `session` lets us detect, after streaming completes, whether a
    // selectRepo/disconnectRepo tool call changed the active repo.
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

          // NEW: if the LLM called selectRepo/disconnectRepo during this
          // turn, session.activeRepoId now differs from what the client
          // sent us — push that change back so the RepositoryPanel/dropdown
          // updates automatically without a manual refresh.
          if (session.activeRepoId !== initialActiveRepoId) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'repoContext', activeRepoId: session.activeRepoId })}\n\n`
              )
            );
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
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}