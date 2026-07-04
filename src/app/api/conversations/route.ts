// ============================================================
// GET /api/conversations
// Returns a summary list of all conversations (no messages),
// sorted most-recently-updated first. Used to populate the sidebar.
// ============================================================
import { NextResponse } from 'next/server';
import { listConversations } from '@/server/db/conversationService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const conversations = await listConversations();
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error('[GET /api/conversations] Error:', err);
    return NextResponse.json({ error: 'Failed to load conversations.' }, { status: 500 });
  }
}
