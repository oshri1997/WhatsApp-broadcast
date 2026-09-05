import { NextResponse } from 'next/server';
import * as seating from '@/lib/server/seating';
import * as guestStore from '@/lib/server/guestStore';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const workspaceId = await requireWorkspaceId();
  // Self-heal: if guests were deleted or the list was re-uploaded, their
  // seat assignments are meaningless - drop them before answering.
  seating.pruneAssignments(workspaceId, new Set(guestStore.getAll(workspaceId).map((g) => g.id)));
  return NextResponse.json(seating.get(workspaceId));
}

export async function POST(request: Request) {
  const workspaceId = await requireWorkspaceId();
  const { count, capacity, name } = (await request.json().catch(() => ({}))) as {
    count?: number;
    capacity?: number;
    name?: string;
  };

  const tableCount = Math.floor(Number(count));
  const tableCapacity = Math.floor(Number(capacity));

  if (!Number.isFinite(tableCount) || tableCount < 1 || tableCount > 100) {
    return NextResponse.json({ error: 'מספר השולחנות חייב להיות בין 1 ל-100' }, { status: 400 });
  }
  if (!Number.isFinite(tableCapacity) || tableCapacity < 1 || tableCapacity > 100) {
    return NextResponse.json({ error: 'מספר המקומות בשולחן חייב להיות בין 1 ל-100' }, { status: 400 });
  }

  seating.addTables(workspaceId, tableCount, tableCapacity, name);
  return NextResponse.json(seating.get(workspaceId));
}
