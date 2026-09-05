import { NextResponse } from 'next/server';
import * as accounts from '@/lib/server/accounts';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const workspaceId = await requireWorkspaceId();
  const { id } = await params;
  try {
    await accounts.logout(workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
