import { NextResponse } from 'next/server';
import * as accounts from '@/lib/server/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  accounts.ensureInitialized();
  accounts.retryDisconnected();
  return NextResponse.json({ accounts: accounts.list() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = accounts.create(body?.label);
  return NextResponse.json({ account: accounts.list().find((a) => a.id === id) ?? null });
}
