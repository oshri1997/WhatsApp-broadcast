import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { workspaceDataDir, writeJsonAtomic } from './dataDir';
import type { MediaKind } from '@/lib/types';

export interface MediaMeta {
  mimetype: string;
  filename: string;
  kind: MediaKind;
  /** Bumped on every upload so the preview URL busts the browser cache. */
  version: number;
}

function files(workspaceId: string) {
  const directory = workspaceDataDir(workspaceId);
  return {
    directory,
    binary: path.join(directory, 'invitation-media.bin'),
    meta: path.join(directory, 'invitation-media.json'),
  };
}

export function getMeta(workspaceId: string): MediaMeta | null {
  const { binary, meta } = files(workspaceId);
  try {
    const value = JSON.parse(fs.readFileSync(meta, 'utf8')) as MediaMeta;
    if (!fs.existsSync(binary)) return null;
    return value;
  } catch {
    return null;
  }
}

export function save(
  workspaceId: string,
  buffer: Buffer,
  mimetype: string,
  filename: string,
  kind: MediaKind
): MediaMeta {
  const { directory, binary, meta } = files(workspaceId);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `.invitation-media.${process.pid}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, buffer, { mode: 0o600 });
    fs.renameSync(temporary, binary);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }

  const value: MediaMeta = { mimetype, filename, kind, version: Date.now() };
  writeJsonAtomic(meta, value);
  return value;
}

export function read(workspaceId: string): { buffer: Buffer; meta: MediaMeta } | null {
  const { binary } = files(workspaceId);
  const meta = getMeta(workspaceId);
  if (!meta) return null;
  return { buffer: fs.readFileSync(binary), meta };
}

/** The base64 payload the WhatsApp client's sendMessage() expects. */
export function readForSending(workspaceId: string): { data: string; mimetype: string; filename: string } | null {
  const file = read(workspaceId);
  if (!file) return null;
  return {
    data: file.buffer.toString('base64'),
    mimetype: file.meta.mimetype,
    filename: file.meta.filename,
  };
}

export function clear(workspaceId: string): void {
  const { binary, meta } = files(workspaceId);
  fs.rmSync(binary, { force: true });
  fs.rmSync(meta, { force: true });
}
