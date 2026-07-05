// ============================================================
// GET /api/repos/[id]/files - Lists directory files
// Query params: ?path=some/folder (relative to repo root)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { listRepositoryDirectory, searchRepositoryFiles } from '@/server/repos/repositoryService';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get('search');

    if (searchQuery !== null) {
      const files = await searchRepositoryFiles(id, searchQuery);
      return NextResponse.json({ files });
    }

    const dirPath = searchParams.get('path') || '';
    const files = await listRepositoryDirectory(id, dirPath);
    return NextResponse.json({ files });
  } catch (err: any) {
    console.error(`[GET /api/repos/[id]/files] Error:`, err);
    return NextResponse.json({ error: err.message || 'Failed to list directory.' }, { status: 500 });
  }
}
