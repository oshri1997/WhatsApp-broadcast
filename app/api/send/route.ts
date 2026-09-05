import { NextResponse } from 'next/server';
import * as accounts from '@/lib/server/accounts';
import * as guestStore from '@/lib/server/guestStore';
import * as media from '@/lib/server/media';
import * as sendJobs from '@/lib/server/sendJobs';
import { resolveAccount } from '@/lib/server/resolve';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const workspaceId = await requireWorkspaceId();
  const { guestIds, message } = (await request.json().catch(() => ({}))) as {
    guestIds?: number[];
    message?: string;
  };

  if (!accounts.list(workspaceId).some((a) => a.status === 'READY')) {
    return NextResponse.json({ error: 'אין אף חשבון וואטסאפ מחובר' }, { status: 400 });
  }
  if (!Array.isArray(guestIds) || guestIds.length === 0) {
    return NextResponse.json({ error: 'לא נבחרו מוזמנים' }, { status: 400 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ error: 'ההודעה ריקה' }, { status: 400 });
  }

  const idSet = new Set(guestIds);
  const selected = guestStore
    .getAll(workspaceId)
    .filter((g) => idSet.has(g.id) && g.valid)
    .map((g) => ({ ...g, accountId: resolveAccount(workspaceId, g)?.id ?? null }))
    .filter((g): g is (typeof g & { accountId: string }) => g.accountId !== null);

  if (selected.length === 0) {
    return NextResponse.json(
      {
        error:
          'לאף אחד מהמוזמנים שנבחרו אין מספר טלפון תקין וצד מחובר שמזוהה עם חשבון וואטסאפ',
      },
      { status: 400 }
    );
  }

  const jobId = sendJobs.createJob(workspaceId, selected, message, media.readForSending(workspaceId));
  return NextResponse.json({ jobId });
}
