import { NextResponse } from 'next/server';
import * as accounts from '@/lib/server/accounts';
import { normalizePhone } from '@/lib/server/phone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnostic: GET /api/debug/number?phone=0501234567
 * Reports what WhatsApp Web knows about a number and which address actually
 * resolves to a chat - for when a send reports success but never arrives.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('phone');
  if (!raw) return NextResponse.json({ error: 'missing ?phone=' }, { status: 400 });

  const phone = normalizePhone(raw);
  if (!phone) return NextResponse.json({ error: 'invalid phone' }, { status: 400 });

  try {
    return NextResponse.json({ phone, report: await accounts.diagnoseNumber(phone) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
