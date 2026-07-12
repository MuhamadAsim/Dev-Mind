// ============================================================
// GET    /api/knowledge/[id] — get a single knowledge base
// DELETE /api/knowledge/[id] — delete KB + cascade
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import {
  getKnowledgeBase,
  deleteKnowledgeBase,
} from '@/server/knowledge/knowledgeBaseService';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const kb = await getKnowledgeBase(id);
    if (!kb) {
      return NextResponse.json({ error: 'Knowledge base not found.' }, { status: 404 });
    }
    return NextResponse.json({ knowledgeBase: kb });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get knowledge base.';
    console.error('[GET /api/knowledge/[id]]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteKnowledgeBase(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Knowledge base not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete knowledge base.';
    console.error('[DELETE /api/knowledge/[id]]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
