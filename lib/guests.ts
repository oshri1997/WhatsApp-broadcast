import type { ResolvedGuest } from './types';

/**
 * A guest can only be sent to if the number is plausible and — when more than
 * one WhatsApp account is connected — their "side" resolves to one of them.
 */
export function isSendable(guest: ResolvedGuest, multipleAccounts: boolean): boolean {
  return guest.valid && !(multipleAccounts && !guest.resolvedAccountId);
}

export function matchesSearch(guest: ResolvedGuest, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  return guest.name.toLowerCase().includes(q) || (guest.phoneRaw || '').includes(q);
}
