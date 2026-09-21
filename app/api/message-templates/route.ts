import { NextResponse } from 'next/server';
import * as templateStore from '@/lib/server/templateStore';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ templates: templateStore.list(await requireWorkspaceId()) });
}

export async function POST(request: Request) {
  const { label, text } = (await request.json().catch(() => ({}))) as { label?: string; text?: string };
  if (!label?.trim()) return NextResponse.json({ error: 'יש לתת שם לתבנית' }, { status: 400 });
  if (!text?.trim()) return NextResponse.json({ error: 'תוכן התבנית ריק' }, { status: 400 });
  const template = templateStore.create(await requireWorkspaceId(), label.trim(), text.trim());
  return NextResponse.json({ template }, { status: 201 });
}
