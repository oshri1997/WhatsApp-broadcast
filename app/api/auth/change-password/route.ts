import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readSession } from '@/lib/auth';
import * as users from '@/lib/server/users';

export async function POST(request: Request) {
  const session = await readSession((await cookies()).get('session')?.value);
  if (!session) return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  try {
    const { currentPassword, nextPassword } = await request.json();
    if (typeof currentPassword !== 'string' || typeof nextPassword !== 'string') {
      return NextResponse.json({ error: 'יש למלא את כל השדות' }, { status: 400 });
    }
    users.changePassword(session.username, currentPassword, nextPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
