// ============================================================
// POST /api/chat/stream
//
// Request body:
//   { conversationId?: string | null; message: string; model?: string }
//
// Flow:
//   1. Create conversation if needed
//   2. Save user message to DB
//   3. Load full history for context
//   4. Stream AI response back to client (plain text chunks)
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

    // ── Validate ──────────────────────────────────────────────
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    // ── 1. Ensure conversation exists ─────────────────────────
    if (!conversationId) {
      // Derive a title from the first message (truncate at 60 chars)
      const title = message.trim().length <= 60
        ? message.trim()
        : message.trim().slice(0, 57) + '…';
      const conv = await createConversation(title, model);
      conversationId = conv.id;
    } else {
      // Verify it exists
      console.log("Incoming conversationId:", conversationId);
      const existing = await getConversation(conversationId);
      console.log("Conversation found:", existing);
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
    // We create it now with empty content so we have the ID to update later.
    const assistantMsgRecord = await addMessage(conversationId, 'assistant', 'Thinking...', {
      status: 'sending',
    });

    // ── 5. Stream AI response ─────────────────────────────────
    console.log("AI Messages:");
    console.dir(aiMessages, { depth: null });
    const textStream = await streamChat({ messages: aiMessages, model, activeRepoId });

    // Accumulate the full response so we can save it when done
    let fullContent = '';

    const responseStream = new ReadableStream({
      async start(controller) {
        // Send the conversationId and assistantMessageId first as a metadata chunk
        // so the client can link the stream to the correct conversation/message.
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
            // Stream each text chunk as an SSE data event
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ type: 'chunk', text: value })}\n\n`)
            );
          }

          // Signal stream end
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (err) {
          // Send error event to client
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted.' })}\n\n`
            )
          );
          controller.close();
          throw err;
        } finally {
          reader.releaseLock();
          // ── 6. Persist completed assistant message ───────────
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
        'X-Accel-Buffering': 'no', // disable nginx buffering
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
