// ============================================================
// POST /api/chat/stream
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { startChatTurn } from '@/server/chat/chatOrchestrator';
import type { ChatSessionContext } from '@/server/chat/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      conversationId?: string | null;
      message: string;
      model?: string;
      activeRepoId?: string | null;
    };

    const { message, model, activeRepoId } = body;
    const { conversationId } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const context: ChatSessionContext = {
      clientType: 'web',
      conversationId: conversationId ?? null,
      activeRepositoryId: activeRepoId ?? null,
      model,
    };

    const {
      conversationId: resolvedConvId,
      assistantMessageId,
      stream: partStream,
      session,
      finalize,
    } = await startChatTurn(context, message);

    const initialActiveRepoId = activeRepoId ?? null;
    let fullContent = '';

    const responseStream = new ReadableStream({
      async start(controller) {
        const meta = JSON.stringify({
          type: 'meta',
          conversationId: resolvedConvId,
          assistantMessageId,
        });
        controller.enqueue(new TextEncoder().encode(`data: ${meta}\n\n`));

        const reader = partStream.getReader();
        try {
          while (true) {
            const { done, value: part } = await reader.read();
            if (done) break;

            if (part.type === 'text') {
              fullContent += part.text;
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify({ type: 'chunk', text: part.text })}\n\n`)
              );
            } else if (part.type === 'tool-call') {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: 'toolCall',
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    input: part.input,
                  })}\n\n`
                )
              );
            } else if (part.type === 'tool-result') {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: 'toolResult',
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    output: part.output,
                  })}\n\n`
                )
              );
            }
          }

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
          await finalize(fullContent);
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