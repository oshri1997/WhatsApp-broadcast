import { NextResponse } from 'next/server';
import * as seating from '@/lib/server/seating';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const workspaceId = await requireWorkspaceId();
  const id = Number((await params).id);
  const { name, capacity } = (await request.json().catch(() => ({}))) as {
    name?: string;
    capacity?: number;
  };

  const table = seating.updateTable(workspaceId, id, { name, capacity: capacity !== undefined ? Number(capacity) : undefined });
  if (!table) return NextResponse.json({ error: 'שולחן לא נמצא' }, { status: 404 });
  return NextResponse.json(seating.get(workspaceId));
}

export async function DELETE(_request: Request, { params }: Context) {
  const workspaceId = await requireWorkspaceId();
  const id = Number((await params).id);
  if (!seating.removeTable(workspaceId, id)) {
    return NextResponse.json({ error: 'שולחן לא נמצא' }, { status: 404 });
  }
  return NextResponse.json(seating.get(workspaceId));
}
