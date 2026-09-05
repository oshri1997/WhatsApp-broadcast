import { NextResponse } from 'next/server';
import * as accounts from '@/lib/server/accounts';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const workspaceId = await requireWorkspaceId();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const account = accounts.rename(workspaceId, id, body?.label ?? '');
  if (!account) return NextResponse.json({ error: 'חיבור לא נמצא' }, { status: 404 });
  return NextResponse.json({ account });
}

export async function DELETE(_request: Request, { params }: Context) {
  const workspaceId = await requireWorkspaceId();
  const { id } = await params;
  const ok = await accounts.remove(workspaceId, id);
  if (!ok) return NextResponse.json({ error: 'חיבור לא נמצא' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
