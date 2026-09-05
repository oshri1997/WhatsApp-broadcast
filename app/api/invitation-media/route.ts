import { NextResponse } from 'next/server';
import type { InvitationMediaView } from '@/lib/types';
import * as media from '@/lib/server/media';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 64 * 1024 * 1024;

function toView(meta: media.MediaMeta | null): InvitationMediaView {
  if (!meta) return { url: null, kind: null, filename: null };
  return {
    url: `/api/invitation-media/file?v=${meta.version}`,
    kind: meta.kind,
    filename: meta.filename,
  };
}

export async function GET() {
  return NextResponse.json(toView(media.getMeta(await requireWorkspaceId())));
}

export async function POST(request: Request) {
  const workspaceId = await requireWorkspaceId();
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('media');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'לא הועלה קובץ' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'הקובץ גדול מדי' }, { status: 400 });
  }

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'הקובץ שהועלה חייב להיות תמונה או סרטון' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const meta = media.save(workspaceId, buffer, file.type, file.name, isVideo ? 'video' : 'image');

  return NextResponse.json(toView(meta));
}

export async function DELETE() {
  media.clear(await requireWorkspaceId());
  return NextResponse.json({ ok: true });
}
