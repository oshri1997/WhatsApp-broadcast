import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import * as users from '@/lib/server/users';
import { allowLoginAttempt } from '@/lib/server/rateLimit';

export async function POST(request: Request) {
  const { username, password } = await request.json();
  if (typeof username !== 'string' || typeof password !== 'string') return NextResponse.json({ error: 'יש למלא שם משתמש וסיסמה' }, { status: 400 });
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowLoginAttempt(`${forwardedFor}:${username.trim().toLowerCase()}`)) {
    return NextResponse.json({ error: 'בוצעו יותר מדי ניסיונות התחברות. נסו שוב בעוד כמה דקות.' }, { status: 429 });
  }
  const role = users.authenticate(username.trim(), password);
  if (!role) return NextResponse.json({ error: 'שם המשתמש או הסיסמה שגויים' }, { status: 401 });
  const response = NextResponse.json({ role });
  response.cookies.set('session', await createSession(username.trim(), role), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 14 });
  return response;
}
