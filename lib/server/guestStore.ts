import fs from 'node:fs';
import path from 'node:path';
import type { Guest } from '@/lib/types';
import { singleton } from './singleton';

// Single source of truth for guest state, shared between the HTTP API and the
// incoming-RSVP-reply handler so both see and mutate the same records.
// Persisted to disk so a server restart doesn't lose who was already invited /
// how they RSVP'd - without this, a restart between sending invites and guests
// replying would silently break RSVP matching (the guest would simply no
// longer exist in memory).
const DATA_FILE = path.join(process.cwd(), 'data', 'guests.json');

interface State {
  guests: Guest[];
  nextId: number;
}

function defaults() {
  return {
    rsvpStatus: null,
    rsvpCount: null,
    rsvpAwaitingCount: false,
    invited: false,
  } satisfies Pick<Guest, 'rsvpStatus' | 'rsvpCount' | 'rsvpAwaitingCount' | 'invited'>;
}

const state = singleton<State>('guestStore', () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const guests: Guest[] = Array.isArray(parsed) ? parsed : [];
    return { guests, nextId: guests.reduce((max, g) => Math.max(max, g.id), 0) + 1 };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error('Failed to load saved guest list, starting empty:', (err as Error).message);
    }
    return { guests: [], nextId: 1 };
  }
});

function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state.guests, null, 2));
  } catch (err) {
    console.error('Failed to save guest list:', (err as Error).message);
  }
}

export function getAll(): Guest[] {
  return state.guests;
}

export function setAll(newGuests: Omit<Guest, keyof ReturnType<typeof defaults>>[]): Guest[] {
  state.guests = newGuests.map((g) => ({ ...defaults(), ...g }));
  state.nextId = state.guests.reduce((max, g) => Math.max(max, g.id), 0) + 1;
  save();
  return state.guests;
}

export function add(partial: Omit<Guest, 'id' | keyof ReturnType<typeof defaults>>): Guest {
  const guest: Guest = { id: state.nextId++, ...defaults(), ...partial };
  state.guests.push(guest);
  save();
  return guest;
}

export function findById(id: number): Guest | null {
  return state.guests.find((g) => g.id === id) ?? null;
}

export function findByPhone(phone: string | null): Guest | null {
  if (!phone) return null;
  return state.guests.find((g) => g.phone === phone) ?? null;
}

export function update(id: number, patch: Partial<Guest>): Guest | null {
  const guest = findById(id);
  if (!guest) return null;
  Object.assign(guest, patch);
  save();
  return guest;
}

export function remove(id: number): boolean {
  const idx = state.guests.findIndex((g) => g.id === id);
  if (idx === -1) return false;
  state.guests.splice(idx, 1);
  save();
  return true;
}

export function clear(): void {
  state.guests = [];
  state.nextId = 1;
  save();
}
