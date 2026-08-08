import * as guestStore from '@/lib/server/guestStore';
import { withResolution } from '@/lib/server/resolve';
import { buildGuestExportBuffer } from '@/lib/server/guestExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const buffer = await buildGuestExportBuffer(guestStore.getAll().map(withResolution));

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="guests.xlsx"',
    },
  });
}
