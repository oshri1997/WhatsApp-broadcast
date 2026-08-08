import fs from 'node:fs';
import path from 'node:path';
import type { AccountView } from '@/lib/types';
import { createAccount, type OutgoingMedia, type WhatsAppAccount } from './whatsappClient';
import * as rsvp from './rsvp';
import { singleton } from './singleton';

export interface Account {
  id: string;
  label: string;
  wa: WhatsAppAccount;
}

interface State {
  accounts: Map<string, Account>;
  nextId: number;
}

// The label is what a guest's "side" column is matched against, so losing it on
// restart would silently break routing even though the WhatsApp session in
// .wwebjs_auth_<id> survives. Persist id+label alongside the session folders.
const ACCOUNTS_FILE = path.join(process.cwd(), 'data', 'accounts.json');

function readPersisted(): { id: string; label: string }[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(state: State) {
  try {
    fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
    const rows = Array.from(state.accounts.values()).map(({ id, label }) => ({ id, label }));
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Failed to save accounts:', (err as Error).message);
  }
}

const state = singleton<State>('accounts', () => ({ accounts: new Map(), nextId: 1 }));

function spawn(id: string, label: string): Account {
  const wa = createAccount(`.wwebjs_auth_${id}`, ({ chatId, phone, body }) => {
    rsvp.handleIncomingMessage(chatId, phone, body, wa.sendRaw).catch((err: Error) => {
      console.error(`RSVP handling failed for account ${id}:`, err.message);
    });
  });
  const account: Account = { id, label, wa };
  state.accounts.set(id, account);
  wa.init();
  return account;
}

export function create(label?: string): string {
  const id = 'acc' + state.nextId++;
  spawn(id, label?.trim() ? label.trim() : `חיבור ${id.replace('acc', '')}`);
  persist(state);
  return id;
}

/**
 * Brings the in-memory accounts back in line with what's on disk. Called from
 * the accounts endpoint rather than at import time so a cold Next.js server
 * doesn't spawn Chromium until the UI is actually open.
 */
export function ensureInitialized(): void {
  if (state.accounts.size > 0) return;

  const persisted = readPersisted();
  if (persisted.length === 0) {
    create('אני');
    return;
  }

  for (const { id, label } of persisted) {
    spawn(id, label);
    const num = parseInt(id.replace('acc', ''), 10);
    if (Number.isFinite(num)) state.nextId = Math.max(state.nextId, num + 1);
  }
}

export function list(): AccountView[] {
  return Array.from(state.accounts.values()).map(({ id, label, wa }) => ({
    id,
    label,
    ...wa.getStatus(),
  }));
}

export function rename(id: string, label: string): AccountView | null {
  const account = state.accounts.get(id);
  if (!account) return null;
  if (label?.trim()) account.label = label.trim();
  persist(state);
  return { id, label: account.label, ...account.wa.getStatus() };
}

export async function remove(id: string): Promise<boolean> {
  const account = state.accounts.get(id);
  if (!account) return false;
  await account.wa.logout().catch(() => {});
  state.accounts.delete(id);
  persist(state);
  return true;
}

export async function logout(id: string): Promise<void> {
  const account = state.accounts.get(id);
  if (!account) throw new Error('חיבור לא נמצא');
  await account.wa.logout();
  account.wa.init();
}

export function retryDisconnected(): void {
  for (const account of state.accounts.values()) {
    if (account.wa.getStatus().status === 'DISCONNECTED') {
      account.wa.init();
    }
  }
}

// Case/whitespace-insensitive match between a guest's "side" value and a
// configured account's label.
export function findByLabel(label: string | null | undefined): Account | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  return (
    Array.from(state.accounts.values()).find((a) => a.label.trim().toLowerCase() === normalized) ??
    null
  );
}

export function count(): number {
  return state.accounts.size;
}

export function first(): Account | null {
  return state.accounts.values().next().value ?? null;
}

export async function sendMessage(
  id: string,
  phone: string,
  text: string,
  media?: OutgoingMedia | null
): Promise<void> {
  const account = state.accounts.get(id);
  if (!account) throw new Error('חשבון השליחה לא נמצא');
  await account.wa.sendMessage(phone, text, media);
}
