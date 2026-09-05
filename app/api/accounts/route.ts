import { NextResponse } from 'next/server';
import * as accounts from '@/lib/server/accounts';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const workspaceId = await requireWorkspaceId();
  accounts.ensureInitialized(workspaceId);
  accounts.retryDisconnected(workspaceId);
  return NextResponse.json({ accounts: accounts.list(workspaceId) });
}

export async function POST(request: Request) {
  const workspaceId = await requireWorkspaceId();
  const body = await request.json().catch(() => ({}));
  const id = accounts.create(workspaceId, body?.label);
  return NextResponse.json({ account: accounts.list(workspaceId).find((a) => a.id === id) ?? null });
}
