import { NextResponse } from 'next/server';
import * as users from '@/lib/server/users';
import * as accounts from '@/lib/server/accounts';
import { removeWorkspaceData } from '@/lib/server/dataDir';

export async function GET() {
  return NextResponse.json({ users: users.list() });
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (typeof email !== 'string') return NextResponse.json({ error: 'יש להזין אימייל' }, { status: 400 });
    return NextResponse.json({ user: users.create(email) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { username } = await request.json();
    if (typeof username !== 'string') return NextResponse.json({ error: 'המשתמש חסר' }, { status: 400 });
    return NextResponse.json({ user: users.resetPassword(username) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { username } = await request.json();
    if (typeof username !== 'string') return NextResponse.json({ error: 'המשתמש חסר' }, { status: 400 });
    await accounts.disposeWorkspace(username);
    removeWorkspaceData(username);
    users.remove(username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
