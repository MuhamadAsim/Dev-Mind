// ============================================================
// GET    /api/knowledge/[id]/documents/[docId] — get document metadata
// DELETE /api/knowledge/[id]/documents/[docId] — delete document + cascade
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getDocument, deleteDocument } from '@/server/knowledge/kbDocumentService';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const document = await getDocument(docId);
    if (!document) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get document.';
    console.error('[GET /api/knowledge/[id]/documents/[docId]]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const deleted = await deleteDocument(docId);
    if (!deleted) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete document.';
    console.error('[DELETE /api/knowledge/[id]/documents/[docId]]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
