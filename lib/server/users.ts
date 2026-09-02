import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './dataDir';

export interface UserRecord {
  username: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');

function read(): UserRecord[] {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function save(users: UserRecord[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function passwordHash(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 210_000, 32, 'sha256').toString('hex');
}

function equals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function randomPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*';
  return Array.from(crypto.randomBytes(16), (byte) => alphabet[byte % alphabet.length]).join('');
}

function usernameFromEmail(email: string, users: UserRecord[]) {
  const localPart = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
  let username = '';
  do username = `${localPart}${crypto.randomInt(1000, 10000)}`;
  while (users.some((user) => user.username === username));
  return username;
}

export function authenticate(username: string, password: string): 'admin' | 'user' | null {
  if (username === process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && equals(password, process.env.ADMIN_PASSWORD)) {
    return 'admin';
  }
  const user = read().find((item) => item.username === username);
  return user && equals(passwordHash(password, user.salt), user.passwordHash) ? 'user' : null;
}

export function list() {
  return read().map(({ username, email, createdAt }) => ({ username, email, createdAt }));
}

export function create(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('כתובת האימייל אינה תקינה');
  const users = read();
  if (users.some((user) => user.email === normalizedEmail)) throw new Error('כבר קיים משתמש עם אימייל זה');
  const password = randomPassword();
  const salt = crypto.randomBytes(16).toString('hex');
  const record: UserRecord = {
    username: usernameFromEmail(normalizedEmail, users),
    email: normalizedEmail,
    salt,
    passwordHash: passwordHash(password, salt),
    createdAt: new Date().toISOString(),
  };
  users.push(record);
  save(users);
  return { username: record.username, password, email: record.email };
}
