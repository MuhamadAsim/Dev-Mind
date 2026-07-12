// ============================================================
// GET  /api/knowledge/[id]/documents — list documents in a KB
// POST /api/knowledge/[id]/documents — upload a document
//
// Upload uses native Next.js request.formData() (no multer).
// Body size limit is set to 50MB to accommodate large PDFs.
// The actual processing is kicked off asynchronously via uploadService.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { listDocuments } from '@/server/knowledge/kbDocumentService';
import { processUpload } from '@/server/knowledge/uploadService';
import { getKnowledgeBase } from '@/server/knowledge/knowledgeBaseService';
import type { DocumentFileType } from '@/server/knowledge/types';

export const runtime = 'nodejs';

// Allow up to 50MB uploads
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documents = await listDocuments(id);
    return NextResponse.json({ documents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list documents.';
    console.error('[GET /api/knowledge/[id]/documents]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: kbId } = await params;

    // Verify KB exists
    const kb = await getKnowledgeBase(kbId);
    if (!kb) {
      return NextResponse.json({ error: 'Knowledge base not found.' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided. Send a "file" field.' }, { status: 400 });
    }

    // Convert File → Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Optional explicit file type override from form
    const explicitType = formData.get('fileType') as DocumentFileType | null;

    const document = await processUpload({
      kbId,
      filename: file.name,
      buffer,
      fileType: explicitType ?? undefined,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to upload document.';
    console.error('[POST /api/knowledge/[id]/documents]', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
