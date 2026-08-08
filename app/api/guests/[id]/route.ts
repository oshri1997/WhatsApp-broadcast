import { NextResponse } from 'next/server';
import type { Guest } from '@/lib/types';
import * as guestStore from '@/lib/server/guestStore';
import { withResolution } from '@/lib/server/resolve';
import { normalizePhone, isPlausiblePhone } from '@/lib/server/phone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const id = Number((await params).id);
  const guest = guestStore.findById(id);
  if (!guest) {
    return NextResponse.json({ error: 'מוזמן לא נמצא' }, { status: 404 });
  }

  const { name, phone, side, customMessage } = (await request.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    side?: string;
    customMessage?: string;
  };
  const patch: Partial<Guest> = {};

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'יש להזין שם' }, { status: 400 });
    patch.name = name.trim();
  }
  if (phone !== undefined) {
    if (!phone.trim()) return NextResponse.json({ error: 'יש להזין מספר טלפון' }, { status: 400 });
    patch.phoneRaw = phone.trim();
    patch.phone = normalizePhone(phone);
    patch.valid = isPlausiblePhone(patch.phone);
  }
  if (side !== undefined) {
    patch.side = side.trim();
  }
  if (customMessage !== undefined) {
    patch.customMessage = customMessage.trim() ? customMessage : null;
  }

  const updated = guestStore.update(id, patch)!;
  return NextResponse.json({ guest: withResolution(updated) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const id = Number((await params).id);
  if (!guestStore.remove(id)) {
    return NextResponse.json({ error: 'מוזמן לא נמצא' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
