import { NextResponse } from 'next/server';
import * as guestStore from '@/lib/server/guestStore';
import { withResolution } from '@/lib/server/resolve';
import { normalizePhone, isPlausiblePhone } from '@/lib/server/phone';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const workspaceId = await requireWorkspaceId();
  return NextResponse.json({ guests: guestStore.getAll(workspaceId).map((guest) => withResolution(workspaceId, guest)) });
}

export async function POST(request: Request) {
  const workspaceId = await requireWorkspaceId();
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
  const guest = guestStore.add(workspaceId, {
    name: name.trim(),
    phone: normalized,
    phoneRaw: phone.trim(),
    side: side?.trim() ?? '',
    valid: isPlausiblePhone(normalized),
  });

  return NextResponse.json({ guest: withResolution(workspaceId, guest) });
}

/** Clears the whole list - the UI only reaches this behind a confirmation. */
export async function DELETE() {
  guestStore.clear(await requireWorkspaceId());
  return NextResponse.json({ ok: true });
}
