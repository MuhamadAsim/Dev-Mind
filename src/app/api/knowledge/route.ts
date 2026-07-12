// ============================================================
// GET  /api/knowledge — list all knowledge bases
// POST /api/knowledge — create a knowledge base
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { listKnowledgeBases, createKnowledgeBase } from '@/server/knowledge/knowledgeBaseService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const kbs = await listKnowledgeBases();
    return NextResponse.json({ knowledgeBases: kbs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list knowledge bases.';
    console.error('[GET /api/knowledge]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      embeddingModel?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 });
    }

    const kb = await createKnowledgeBase(body.name, body.description, body.embeddingModel);
    return NextResponse.json({ knowledgeBase: kb }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create knowledge base.';
    console.error('[POST /api/knowledge]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
