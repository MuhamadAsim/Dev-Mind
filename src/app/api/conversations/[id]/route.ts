// ============================================================
// /api/conversations/[id]
//
// GET    — fetch a single conversation's metadata
// PATCH  — rename and/or pin a conversation { title?, isPinned? }
// DELETE — delete conversation + all its messages
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import {
  getConversation,
  renameConversation,
  deleteConversation,
  setConversationPinned,
} from '@/server/db/conversationService';
import { deleteMessagesByConversation } from '@/server/db/messageService';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET /api/conversations/[id] ───────────────────────────────
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const conversation = await getConversation(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    return NextResponse.json({ conversation });
  } catch (err) {
    console.error('[GET /api/conversations/[id]] Error:', err);
    return NextResponse.json({ error: 'Failed to load conversation.' }, { status: 500 });
  }
}

// ── PATCH /api/conversations/[id] — rename and/or pin ─────────
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json() as { title?: string; isPinned?: boolean };

    if (body.title === undefined && body.isPinned === undefined) {
      return NextResponse.json(
        { error: 'Provide at least one of: title, isPinned.' },
        { status: 400 }
      );
    }

    let conversation = null;

    if (typeof body.isPinned === 'boolean') {
      conversation = await setConversationPinned(id, body.isPinned);
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
      }
    }

    if (body.title?.trim()) {
      conversation = await renameConversation(id, body.title);
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
      }
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    console.error('[PATCH /api/conversations/[id]] Error:', err);
    return NextResponse.json({ error: 'Failed to update conversation.' }, { status: 500 });
  }
}

// ── DELETE /api/conversations/[id] ───────────────────────────
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    // Delete messages first (orphan prevention), then the conversation
    await deleteMessagesByConversation(id);
    const deleted = await deleteConversation(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/conversations/[id]] Error:', err);
    return NextResponse.json({ error: 'Failed to delete conversation.' }, { status: 500 });
  }
}