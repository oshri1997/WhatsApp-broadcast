import type { ResolvedGuest, RsvpFilter } from './types';

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

export function matchesRsvpFilter(guest: ResolvedGuest, filter: RsvpFilter): boolean {
  if (!filter) return true;
  if (filter === 'not-invited') return !guest.invited;
  if (!guest.invited) return false;
  if (filter === 'pending') return !guest.rsvpStatus;
  return guest.rsvpStatus === filter;
}

export function rsvpDescription(guest: ResolvedGuest): {
  label: string;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
} {
  if (!guest.invited) return { label: 'טרם נשלח', tone: 'neutral' };
  if (guest.rsvpStatus === 'yes') {
    return {
      label: guest.rsvpAwaitingCount ? 'מגיע · ממתין לכמות' : `מגיע · ${guest.rsvpCount ?? '?'}`,
      tone: 'good',
    };
  }
  if (guest.rsvpStatus === 'no') return { label: 'לא מגיע', tone: 'bad' };
  if (guest.rsvpStatus === 'maybe') return { label: 'אולי', tone: 'warn' };
  return { label: 'ממתין לתשובה', tone: 'neutral' };
}
