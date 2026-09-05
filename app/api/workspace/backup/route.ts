import { serializeWorkspaceBackup } from '@/lib/server/backup';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A user-owned portable backup; authentication credentials are deliberately excluded. */
export async function GET() {
  const workspaceId = await requireWorkspaceId();
  return new Response(serializeWorkspaceBackup(workspaceId), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="wedding-workspace-backup.json"',
      'Cache-Control': 'no-store',
    },
  });
}
