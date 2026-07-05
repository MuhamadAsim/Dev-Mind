// ============================================================
// DELETE /api/repos/[id] - Disconnects a repository
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { disconnectRepository } from '@/server/repos/repositoryService';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await disconnectRepository(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[DELETE /api/repos/[id]] Error:`, err);
    return NextResponse.json({ error: err.message || 'Failed to disconnect repository.' }, { status: 500 });
  }
}
