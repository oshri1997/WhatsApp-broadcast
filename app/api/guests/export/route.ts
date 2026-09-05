import * as guestStore from '@/lib/server/guestStore';
import { withResolution } from '@/lib/server/resolve';
import { buildGuestExportBuffer } from '@/lib/server/guestExport';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const workspaceId = await requireWorkspaceId();
  const buffer = await buildGuestExportBuffer(guestStore.getAll(workspaceId).map((guest) => withResolution(workspaceId, guest)));

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="guests.xlsx"',
    },
  });
}
