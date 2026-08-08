import { NextResponse } from 'next/server';
import * as guestStore from '@/lib/server/guestStore';
import { withResolution } from '@/lib/server/resolve';
import { normalizePhone, isPlausiblePhone } from '@/lib/server/phone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ guests: guestStore.getAll().map(withResolution) });
}

export async function POST(request: Request) {
  const { name, phone, side } = (await request.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    side?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: 'יש להזין שם' }, { status: 400 });
  }
  if (!phone?.trim()) {
    return NextResponse.json({ error: 'יש להזין מספר טלפון' }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  const guest = guestStore.add({
    name: name.trim(),
    phone: normalized,
    phoneRaw: phone.trim(),
    side: side?.trim() ?? '',
    valid: isPlausiblePhone(normalized),
  });

  return NextResponse.json({ guest: withResolution(guest) });
}

/** Clears the whole list - the UI only reaches this behind a confirmation. */
export async function DELETE() {
  guestStore.clear();
  return NextResponse.json({ ok: true });
}
