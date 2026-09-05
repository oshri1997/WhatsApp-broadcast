import fs from 'node:fs';
import path from 'node:path';
import { workspaceDataDir } from './dataDir';

const BACKUP_VERSION = 1;
const SAFE_FILES = [
  'guests.json',
  'seating.json',
  'accounts.json',
  'invitation-media.json',
  'send-jobs.json',
] as const;
type SafeFileName = (typeof SAFE_FILES)[number];

export interface WorkspaceBackup {
  version: typeof BACKUP_VERSION;
  workspaceId: string;
  createdAt: string;
  data: Partial<Record<SafeFileName, unknown>>;
}

function readJsonIfPresent(file: string): unknown | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Skipping unreadable file during workspace backup:', (error as Error).message);
    }
    return undefined;
  }
}

/**
 * Makes a portable JSON-safe snapshot for one workspace. It never traverses
 * Baileys auth folders, password files, or users/admin records.
 */
export function createWorkspaceBackup(workspaceId: string): WorkspaceBackup {
  const data: Partial<Record<SafeFileName, unknown>> = {};
  for (const fileName of SAFE_FILES) {
    const value = readJsonIfPresent(path.join(workspaceDataDir(workspaceId), fileName));
    if (value !== undefined) data[fileName] = value;
  }
  return { version: BACKUP_VERSION, workspaceId, createdAt: new Date().toISOString(), data };
}

export function serializeWorkspaceBackup(workspaceId: string): string {
  return JSON.stringify(createWorkspaceBackup(workspaceId), null, 2);
}
