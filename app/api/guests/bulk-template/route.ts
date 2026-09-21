import { NextResponse } from 'next/server';
import * as guestStore from '@/lib/server/guestStore';
import { list as listTemplates } from '@/lib/server/templateStore';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const workspaceId = await requireWorkspaceId();
  const body = (await request.json().catch(() => ({}))) as { guestIds?: unknown; templateId?: unknown };
  const guestIds = Array.isArray(body.guestIds)
    ? [...new Set(body.guestIds.filter((id): id is number => Number.isInteger(id) && id > 0))]
    : [];
  const templateId = typeof body.templateId === 'string' ? body.templateId.trim() : '';

  if (guestIds.length === 0) {
    return NextResponse.json({ error: 'יש לבחור לפחות מוזמן אחד' }, { status: 400 });
  }
  if (!templateId || !listTemplates(workspaceId).some((template) => template.id === templateId)) {
    return NextResponse.json({ error: 'יש לבחור תבנית קיימת' }, { status: 400 });
  }

  const updated = guestStore.assignTemplate(workspaceId, guestIds, templateId);
  return NextResponse.json({ updated });
}
