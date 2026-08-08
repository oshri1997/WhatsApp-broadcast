import { NextResponse } from 'next/server';
import * as guestStore from '@/lib/server/guestStore';
import { withResolution } from '@/lib/server/resolve';
import { parseGuestsFromBuffer } from '@/lib/server/excelParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'לא הועלה קובץ' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'הקובץ גדול מדי' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    guestStore.setAll(await parseGuestsFromBuffer(buffer));
    return NextResponse.json({ guests: guestStore.getAll().map(withResolution) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
