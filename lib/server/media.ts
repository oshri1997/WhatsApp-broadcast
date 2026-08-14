import fs from 'node:fs';
import path from 'node:path';
import type { MediaKind } from '@/lib/types';

// The invitation image/video used to live in memory as a base64 string that
// was also handed to the browser as a giant data: URL. Writing it to disk
// instead means it survives a server restart and the UI can preview it through
// a normal cacheable URL rather than inlining megabytes into the HTML.
const DIR = path.join(process.cwd(), 'data');
const BIN_FILE = path.join(DIR, 'invitation-media.bin');
const META_FILE = path.join(DIR, 'invitation-media.json');

export interface MediaMeta {
  mimetype: string;
  filename: string;
  kind: MediaKind;
  /** Bumped on every upload so the preview URL busts the browser cache. */
  version: number;
}

export function getMeta(): MediaMeta | null {
  try {
    const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8')) as MediaMeta;
    if (!fs.existsSync(BIN_FILE)) return null;
    return meta;
  } catch {
    return null;
  }
}

export function save(buffer: Buffer, mimetype: string, filename: string, kind: MediaKind): MediaMeta {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(BIN_FILE, buffer);
  const meta: MediaMeta = { mimetype, filename, kind, version: Date.now() };
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
  return meta;
}

export function read(): { buffer: Buffer; meta: MediaMeta } | null {
  const meta = getMeta();
  if (!meta) return null;
  return { buffer: fs.readFileSync(BIN_FILE), meta };
}

/** The base64 payload the WhatsApp client's sendMessage() expects. */
export function readForSending(): { data: string; mimetype: string; filename: string } | null {
  const file = read();
  if (!file) return null;
  return {
    data: file.buffer.toString('base64'),
    mimetype: file.meta.mimetype,
    filename: file.meta.filename,
  };
}

export function clear(): void {
  fs.rmSync(BIN_FILE, { force: true });
  fs.rmSync(META_FILE, { force: true });
}
