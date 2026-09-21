import { NextResponse } from 'next/server';
import * as templateStore from '@/lib/server/templateStore';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { label, text } = (await request.json().catch(() => ({}))) as { label?: string; text?: string };
  if (!label?.trim() || !text?.trim()) return NextResponse.json({ error: 'יש לתת שם ותוכן לתבנית' }, { status: 400 });
  const template = templateStore.update(await requireWorkspaceId(), (await params).id, { label: label.trim(), text: text.trim() });
  if (!template) return NextResponse.json({ error: 'התבנית לא נמצאה' }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(_request: Request, { params }: Context) {
  if (!templateStore.remove(await requireWorkspaceId(), (await params).id)) {
    return NextResponse.json({ error: 'התבנית לא נמצאה' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
