import { NextResponse } from 'next/server';
import * as accounts from '@/lib/server/accounts';
import { normalizePhone } from '@/lib/server/phone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnostic: GET /api/debug/send-test?phone=0501234567
 * Sends one real message, then reports what WhatsApp actually stored for it -
 * distinguishing "never sent" from "sent but the library's return lookup missed".
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get('phone');
  if (!raw) return NextResponse.json({ error: 'missing ?phone=' }, { status: 400 });

  const phone = normalizePhone(raw);
  if (!phone) return NextResponse.json({ error: 'invalid phone' }, { status: 400 });

  const text = params.get('text') || `בדיקה ${new Date().toLocaleTimeString('he-IL')}`;

  try {
    return NextResponse.json({ phone, text, result: await accounts.testSendToNumber(phone, text) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
