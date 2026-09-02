import { NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  const session = await readSession(request.cookies.get('session')?.value);
  if (!session) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && session.role !== 'admin') {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'אין הרשאת מנהל' }, { status: 403 })
      : NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
