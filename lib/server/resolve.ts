import type { Guest, ResolvedGuest } from '@/lib/types';
import * as accounts from './accounts';

// Decides which WhatsApp account should send to a given guest. With a single
// connected account, everyone routes through it regardless of the "side"
// column. With two or more, the guest's side must match a configured account's
// label (case/whitespace-insensitive).
export function resolveAccount(guest: Pick<Guest, 'side'>): accounts.Account | null {
  if (accounts.count() === 1) return accounts.first();
  if (!guest.side) return null;
  return accounts.findByLabel(guest.side);
}

export function withResolution(guest: Guest): ResolvedGuest {
  const account = resolveAccount(guest);
  return {
    ...guest,
    resolvedAccountId: account ? account.id : null,
    resolvedAccountLabel: account ? account.label : null,
  };
}
