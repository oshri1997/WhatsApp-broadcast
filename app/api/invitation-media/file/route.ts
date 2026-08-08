import { NextResponse } from 'next/server';
import * as media from '@/lib/server/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const file = media.read();
  if (!file) return NextResponse.json({ error: 'לא הועלה קובץ' }, { status: 404 });

  return new Response(new Uint8Array(file.buffer), {
    headers: {
      'Content-Type': file.meta.mimetype,
      // The URL carries a ?v= cache-buster that changes on every upload, so the
      // bytes behind any given URL are immutable.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
