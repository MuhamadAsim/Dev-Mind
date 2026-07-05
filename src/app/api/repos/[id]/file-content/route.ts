// ============================================================
// GET /api/repos/[id]/file-content - Reads file contents
// Query params: ?path=src/index.ts (relative to repo root)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { readRepositoryFile } from '@/server/repos/repositoryService';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'path query parameter is required.' }, { status: 400 });
    }

    const content = await readRepositoryFile(id, filePath);
    return NextResponse.json({ content });
  } catch (err: any) {
    console.error(`[GET /api/repos/[id]/file-content] Error:`, err);
    return NextResponse.json({ error: err.message || 'Failed to read file content.' }, { status: 500 });
  }
}
