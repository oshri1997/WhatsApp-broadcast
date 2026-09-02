import { NextResponse } from 'next/server';
import * as users from '@/lib/server/users';

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
