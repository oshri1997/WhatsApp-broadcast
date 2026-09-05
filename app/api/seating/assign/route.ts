import { NextResponse } from 'next/server';
import * as seating from '@/lib/server/seating';
import * as guestStore from '@/lib/server/guestStore';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const workspaceId = await requireWorkspaceId();
  const { guestId, tableId } = (await request.json().catch(() => ({}))) as {
    guestId?: number;
    tableId?: number | null;
  };

  const guest = guestStore.findById(workspaceId, Number(guestId));
  if (!guest) return NextResponse.json({ error: 'מוזמן לא נמצא' }, { status: 404 });

  if (tableId != null) {
    if (!seating.tableExists(workspaceId, Number(tableId))) {
      return NextResponse.json({ error: 'שולחן לא נמצא' }, { status: 404 });
    }
    seating.assign(workspaceId, guest.id, Number(tableId));
  } else {
    seating.assign(workspaceId, guest.id, null);
  }

  return NextResponse.json(seating.get(workspaceId));
}
