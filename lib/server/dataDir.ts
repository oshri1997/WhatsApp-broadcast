import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

// Railway mounts persistent storage at /data. Locally, keep using the
// repository's ignored data directory so development needs no environment setup.
export const DATA_DIR = process.env.APP_DATA_DIR || path.join(process.cwd(), 'data');

/**
 * The only compatibility route to data written before workspace isolation.
 * New application workspaces are always stored below DATA_DIR/workspaces.
 */
export const LEGACY_WORKSPACE_ID = 'legacy';

const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * Resolves a user-owned directory without ever allowing a workspace id to
 * influence the filesystem path. Usernames currently satisfy this contract.
 */
export function workspaceDataDir(workspaceId: string): string {
  if (workspaceId === LEGACY_WORKSPACE_ID) return DATA_DIR;
  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) {
    throw new Error('מזהה סביבת העבודה אינו תקין');
  }
  return path.join(DATA_DIR, 'workspaces', workspaceId);
}

/** Write a complete JSON document before replacing the previous version. */
export function writeJsonAtomic(file: string, value: unknown): void {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

/** Returns whether a non-legacy workspace directory has been created. */
export function workspaceExists(workspaceId: string): boolean {
  if (workspaceId === LEGACY_WORKSPACE_ID) return false;
  return fs.existsSync(workspaceDataDir(workspaceId));
}

/** Removes only a validated, isolated workspace; legacy data is never deleted here. */
export function removeWorkspaceData(workspaceId: string): void {
  if (workspaceId === LEGACY_WORKSPACE_ID) {
    throw new Error('לא ניתן למחוק את נתוני סביבת העבודה הישנה');
  }
  fs.rmSync(workspaceDataDir(workspaceId), { recursive: true, force: true });
}

/**
 * Explicitly copies pre-isolation data into a workspace. This is intentionally
 * never called while resolving ordinary workspaces, so legacy data cannot
 * appear in a newly created couple's account by accident.
 */
export function bootstrapWorkspaceFromLegacy(workspaceId: string): boolean {
  if (workspaceId === LEGACY_WORKSPACE_ID) return false;
  const destination = workspaceDataDir(workspaceId);
  if (fs.existsSync(destination)) return false;
  if (!fs.existsSync(DATA_DIR)) return false;

  const files = [
    'guests.json',
    'seating.json',
    'accounts.json',
    'invitation-media.bin',
    'invitation-media.json',
  ];
  const legacyFiles = files.filter((file) => fs.existsSync(path.join(DATA_DIR, file)));
  const legacyAuthDirectories = fs.readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\.baileys_auth_[A-Za-z0-9_-]+$/.test(entry.name))
    .map((entry) => entry.name);

  if (legacyFiles.length === 0 && legacyAuthDirectories.length === 0) return false;

  fs.mkdirSync(destination, { recursive: true });
  for (const file of legacyFiles) {
    fs.copyFileSync(path.join(DATA_DIR, file), path.join(destination, file));
  }
  for (const directory of legacyAuthDirectories) {
    fs.cpSync(path.join(DATA_DIR, directory), path.join(destination, directory), {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
  }
  return true;
}
