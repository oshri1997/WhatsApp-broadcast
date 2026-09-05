import { NextResponse } from 'next/server';
import { getAdminOverview } from '@/lib/server/adminOverview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getAdminOverview(), { headers: { 'Cache-Control': 'no-store' } });
}
