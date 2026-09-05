import type { Guest, ResolvedGuest } from '@/lib/types';
import * as accounts from './accounts';

// Decides which WhatsApp account should send to a given guest. With a single
// connected account, everyone routes through it regardless of the "side"
// column. With two or more, the guest's side must match a configured account's
// label (case/whitespace-insensitive).
export function resolveAccount(workspaceId: string, guest: Pick<Guest, 'side'>): accounts.Account | null {
  if (accounts.count(workspaceId) === 1) return accounts.first(workspaceId);
  if (!guest.side) return null;
  return accounts.findByLabel(workspaceId, guest.side);
}

export function withResolution(workspaceId: string, guest: Guest): ResolvedGuest {
  const account = resolveAccount(workspaceId, guest);
  return {
    ...guest,
    resolvedAccountId: account ? account.id : null,
    resolvedAccountLabel: account ? account.label : null,
  };
}
