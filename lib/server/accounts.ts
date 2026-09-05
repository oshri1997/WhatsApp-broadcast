import fs from 'node:fs';
import path from 'node:path';
import type { AccountView } from '@/lib/types';
import { createAccount, type OutgoingMedia, type WhatsAppAccount } from './whatsappClient';
import { singleton } from './singleton';
import { workspaceDataDir, writeJsonAtomic } from './dataDir';

export interface Account {
  id: string;
  label: string;
  wa: WhatsAppAccount;
}

interface State {
  accounts: Map<string, Account>;
  nextId: number;
}

const states = singleton<Map<string, State>>('accounts-workspaces', () => new Map());

function accountsFile(workspaceId: string): string {
  return path.join(workspaceDataDir(workspaceId), 'accounts.json');
}

function stateFor(workspaceId: string): State {
  const existing = states.get(workspaceId);
  if (existing) return existing;
  const state: State = { accounts: new Map(), nextId: 1 };
  states.set(workspaceId, state);
  return state;
}

function readPersisted(workspaceId: string): { id: string; label: string }[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(accountsFile(workspaceId), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(workspaceId: string, state: State): void {
  try {
    const rows = Array.from(state.accounts.values()).map(({ id, label }) => ({ id, label }));
    writeJsonAtomic(accountsFile(workspaceId), rows);
  } catch (error) {
    console.error('Failed to save accounts:', (error as Error).message);
  }
}

function spawn(workspaceId: string, id: string, label: string): Account {
  const wa = createAccount(path.join(workspaceDataDir(workspaceId), `.baileys_auth_${id}`));
  const account: Account = { id, label, wa };
  stateFor(workspaceId).accounts.set(id, account);
  wa.init();
  return account;
}

export function create(workspaceId: string, label?: string): string {
  const state = stateFor(workspaceId);
  const id = `acc${state.nextId++}`;
  spawn(workspaceId, id, label?.trim() ? label.trim() : `חיבור ${id.replace('acc', '')}`);
  persist(workspaceId, state);
  return id;
}

/**
 * Brings one workspace's in-memory accounts back in line with its own disk
 * state. This deliberately never opens another user's WhatsApp sessions.
 */
export function ensureInitialized(workspaceId: string): void {
  const state = stateFor(workspaceId);
  if (state.accounts.size > 0) return;

  const persisted = readPersisted(workspaceId);
  if (persisted.length === 0) {
    create(workspaceId, 'אני');
    return;
  }

  for (const { id, label } of persisted) {
    spawn(workspaceId, id, label);
    const number = Number.parseInt(id.replace('acc', ''), 10);
    if (Number.isFinite(number)) state.nextId = Math.max(state.nextId, number + 1);
  }
}

export function list(workspaceId: string): AccountView[] {
  return Array.from(stateFor(workspaceId).accounts.values()).map(({ id, label, wa }) => ({
    id,
    label,
    ...wa.getStatus(),
  }));
}

export function rename(workspaceId: string, id: string, label: string): AccountView | null {
  const state = stateFor(workspaceId);
  const account = state.accounts.get(id);
  if (!account) return null;
  if (label?.trim()) account.label = label.trim();
  persist(workspaceId, state);
  return { id, label: account.label, ...account.wa.getStatus() };
}

export async function remove(workspaceId: string, id: string): Promise<boolean> {
  const state = stateFor(workspaceId);
  const account = state.accounts.get(id);
  if (!account) return false;
  await account.wa.logout().catch(() => {});
  state.accounts.delete(id);
  persist(workspaceId, state);
  return true;
}

export async function logout(workspaceId: string, id: string): Promise<void> {
  const account = stateFor(workspaceId).accounts.get(id);
  if (!account) throw new Error('חיבור לא נמצא');
  await account.wa.logout();
  account.wa.init();
}

export function retryDisconnected(workspaceId: string): void {
  for (const account of stateFor(workspaceId).accounts.values()) {
    if (account.wa.getStatus().status === 'DISCONNECTED') account.wa.init();
  }
}

export async function shutdownAll(workspaceId: string): Promise<void> {
  await Promise.all(Array.from(stateFor(workspaceId).accounts.values()).map((account) => account.wa.shutdown()));
}

/** Close and forget live sockets before their workspace directory is deleted. */
export async function disposeWorkspace(workspaceId: string): Promise<void> {
  const state = states.get(workspaceId);
  if (!state) return;
  await Promise.all(Array.from(state.accounts.values()).map((account) => account.wa.logout().catch(() => {})));
  states.delete(workspaceId);
}

async function shutdownEveryWorkspace(): Promise<void> {
  await Promise.all(Array.from(states.keys()).map((workspaceId) => shutdownAll(workspaceId)));
}

singleton('accounts-shutdown-handlers', () => {
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received - closing WhatsApp sessions...`);
    const timeout = new Promise((resolve) => setTimeout(resolve, 8000));
    await Promise.race([shutdownEveryWorkspace(), timeout]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  return true;
});

export function findByLabel(workspaceId: string, label: string | null | undefined): Account | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  return (
    Array.from(stateFor(workspaceId).accounts.values()).find(
      (account) => account.label.trim().toLowerCase() === normalized
    ) ?? null
  );
}

export function count(workspaceId: string): number {
  return stateFor(workspaceId).accounts.size;
}

export function first(workspaceId: string): Account | null {
  return stateFor(workspaceId).accounts.values().next().value ?? null;
}

export async function sendMessage(
  workspaceId: string,
  id: string,
  phone: string,
  text: string,
  media?: OutgoingMedia | null
): Promise<void> {
  const account = stateFor(workspaceId).accounts.get(id);
  if (!account) throw new Error('חשבון השליחה לא נמצא');
  await account.wa.sendMessage(phone, text, media);
}
