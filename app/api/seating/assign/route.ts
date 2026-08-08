import { NextResponse } from 'next/server';
import * as seating from '@/lib/server/seating';
import * as guestStore from '@/lib/server/guestStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { guestId, tableId } = (await request.json().catch(() => ({}))) as {
    guestId?: number;
    tableId?: number | null;
  };

  const guest = guestStore.findById(Number(guestId));
  if (!guest) return NextResponse.json({ error: 'מוזמן לא נמצא' }, { status: 404 });

  if (tableId != null) {
    if (!seating.tableExists(Number(tableId))) {
      return NextResponse.json({ error: 'שולחן לא נמצא' }, { status: 404 });
    }
    seating.assign(guest.id, Number(tableId));
  } else {
    seating.assign(guest.id, null);
  }

  return NextResponse.json(seating.get());
}
