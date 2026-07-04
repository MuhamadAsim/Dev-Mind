// ============================================================
// GET /api/conversations/[id]/messages
// Returns all messages for a conversation, ordered chronologically.
// Called when the user clicks a conversation in the sidebar.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getMessages } from '@/server/db/messageService';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const messages = await getMessages(id);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[GET /api/conversations/[id]/messages] Error:', err);
    return NextResponse.json({ error: 'Failed to load messages.' }, { status: 500 });
  }
}
