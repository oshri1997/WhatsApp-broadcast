import fs from 'node:fs';
import path from 'node:path';
import { workspaceDataDir, writeJsonAtomic } from './dataDir';
import type { Guest } from '@/lib/types';
import { singleton } from './singleton';

interface State {
  guests: Guest[];
  nextId: number;
}

function defaults() {
  return { invited: false } satisfies Pick<Guest, 'invited'>;
}

const states = singleton<Map<string, State>>('guestStore-workspaces', () => new Map());

function dataFile(workspaceId: string): string {
  return path.join(workspaceDataDir(workspaceId), 'guests.json');
}

function stateFor(workspaceId: string): State {
  const existing = states.get(workspaceId);
  if (existing) return existing;

  let state: State;
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile(workspaceId), 'utf8'));
    const guests: Guest[] = Array.isArray(parsed) ? parsed : [];
    state = { guests, nextId: guests.reduce((max, guest) => Math.max(max, guest.id), 0) + 1 };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error('Failed to load saved guest list, starting empty:', (error as Error).message);
    }
    state = { guests: [], nextId: 1 };
  }
  states.set(workspaceId, state);
  return state;
}

function save(workspaceId: string, state: State): void {
  try {
    writeJsonAtomic(dataFile(workspaceId), state.guests);
  } catch (error) {
    console.error('Failed to save guest list:', (error as Error).message);
  }
}

export function getAll(workspaceId: string): Guest[] {
  return stateFor(workspaceId).guests;
}

export function setAll(workspaceId: string, newGuests: Omit<Guest, keyof ReturnType<typeof defaults>>[]): Guest[] {
  const state = stateFor(workspaceId);
  state.guests = newGuests.map((guest) => ({ ...defaults(), ...guest }));
  state.nextId = state.guests.reduce((max, guest) => Math.max(max, guest.id), 0) + 1;
  save(workspaceId, state);
  return state.guests;
}

export function add(workspaceId: string, partial: Omit<Guest, 'id' | keyof ReturnType<typeof defaults>>): Guest {
  const state = stateFor(workspaceId);
  const guest: Guest = { id: state.nextId++, ...defaults(), ...partial };
  state.guests.push(guest);
  save(workspaceId, state);
  return guest;
}

export function findById(workspaceId: string, id: number): Guest | null {
  return stateFor(workspaceId).guests.find((guest) => guest.id === id) ?? null;
}

export function findByPhone(workspaceId: string, phone: string | null): Guest | null {
  if (!phone) return null;
  return stateFor(workspaceId).guests.find((guest) => guest.phone === phone) ?? null;
}

export function update(workspaceId: string, id: number, patch: Partial<Guest>): Guest | null {
  const state = stateFor(workspaceId);
  const guest = findById(workspaceId, id);
  if (!guest) return null;
  Object.assign(guest, patch);
  save(workspaceId, state);
  return guest;
}

export function remove(workspaceId: string, id: number): boolean {
  const state = stateFor(workspaceId);
  const index = state.guests.findIndex((guest) => guest.id === id);
  if (index === -1) return false;
  state.guests.splice(index, 1);
  save(workspaceId, state);
  return true;
}

export function clear(workspaceId: string): void {
  const state = stateFor(workspaceId);
  state.guests = [];
  state.nextId = 1;
  save(workspaceId, state);
}
