import { singleton } from './singleton';

type Entry = { count: number; resetAt: number };

const attempts = singleton<Map<string, Entry>>('login-rate-limit', () => new Map());
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/**
 * A small in-process guard for the single Railway beta service. It is not a
 * replacement for edge/WAF rate limiting when the service later scales out.
 */
export function allowLoginAttempt(key: string): boolean {
  const now = Date.now();
  const existing = attempts.get(key);
  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= MAX_ATTEMPTS) return false;
  existing.count++;
  return true;
}
