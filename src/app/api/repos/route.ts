// ============================================================
// GET /api/repos - Lists all connected repositories
// POST /api/repos - Connects a repository
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { listConnectedRepositories, connectRepository } from '@/server/repos/repositoryService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const repos = await listConnectedRepositories();
    return NextResponse.json({ repos });
  } catch (err: any) {
    console.error('[GET /api/repos] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to list repositories.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      type: 'github' | 'local';
      config: Record<string, string>;
    };

    const { type, config } = body;
    if (!type || !config) {
      return NextResponse.json({ error: 'type and config are required.' }, { status: 400 });
    }

    const newRepo = await connectRepository(type, config);
    return NextResponse.json({ repo: newRepo });
  } catch (err: any) {
    console.error('[POST /api/repos] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to connect repository.' }, { status: 500 });
  }
}
