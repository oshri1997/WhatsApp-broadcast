export type Role = 'admin' | 'user';

export interface Session {
  username: string;
  role: Role;
  issuedAt: number;
  expiresAt: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encode(value: string) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decode(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
}

async function signature(payload: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return encode(String.fromCharCode(...new Uint8Array(bytes)));
}

export async function createSession(username: string, role: Role): Promise<string> {
  const issuedAt = Date.now();
  const payload = encode(JSON.stringify({ username, role, issuedAt, expiresAt: issuedAt + 1000 * 60 * 60 * 24 * 14 }));
  return `${payload}.${await signature(payload)}`;
}

export async function readSession(token?: string): Promise<Session | null> {
  if (!token) return null;
  const [payload, provided] = token.split('.');
  if (!payload || !provided) return null;
  const expected = await signature(payload);
  if (expected.length !== provided.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index++) mismatch |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  if (mismatch !== 0) return null;
  try {
    const session = JSON.parse(decode(payload)) as Session;
    return session.issuedAt > 0 && session.expiresAt > Date.now() && (session.role === 'admin' || session.role === 'user') ? session : null;
  } catch {
    return null;
  }
}
