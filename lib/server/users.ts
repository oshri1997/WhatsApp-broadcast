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
  /** Sessions issued before this timestamp are invalid after a password reset. */
  sessionsValidAfter?: number;
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin-password.json');

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

function readAdminPassword() {
  try {
    const value = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8')) as { salt?: string; passwordHash?: string; sessionsValidAfter?: number };
    return value.salt && value.passwordHash ? { salt: value.salt, passwordHash: value.passwordHash, sessionsValidAfter: value.sessionsValidAfter ?? 0 } : null;
  } catch {
    return null;
  }
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
  if (username === process.env.ADMIN_USERNAME) {
    const savedAdmin = readAdminPassword();
    if (savedAdmin && equals(passwordHash(password, savedAdmin.salt), savedAdmin.passwordHash)) return 'admin';
    if (!savedAdmin && process.env.ADMIN_PASSWORD && equals(password, process.env.ADMIN_PASSWORD)) return 'admin';
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
    sessionsValidAfter: Date.now(),
  };
  users.push(record);
  save(users);
  return { username: record.username, password, email: record.email };
}

export function resetPassword(username: string) {
  const users = read();
  const index = users.findIndex((user) => user.username === username);
  if (index < 0) throw new Error('המשתמש לא נמצא');
  const password = randomPassword();
  const salt = crypto.randomBytes(16).toString('hex');
  users[index] = { ...users[index], salt, passwordHash: passwordHash(password, salt), sessionsValidAfter: Date.now() };
  save(users);
  return { username: users[index].username, email: users[index].email, password };
}

export function remove(username: string) {
  const users = read();
  const nextUsers = users.filter((user) => user.username !== username);
  if (nextUsers.length === users.length) throw new Error('המשתמש לא נמצא');
  save(nextUsers);
}

export function changePassword(username: string, currentPassword: string, nextPassword: string) {
  if (nextPassword.length < 12) throw new Error('הסיסמה החדשה חייבת להכיל לפחות 12 תווים');
  if (currentPassword === nextPassword) throw new Error('הסיסמה החדשה חייבת להיות שונה מהנוכחית');
  if (!authenticate(username, currentPassword)) throw new Error('הסיסמה הנוכחית שגויה');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHashValue = passwordHash(nextPassword, salt);
  if (username === process.env.ADMIN_USERNAME) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ADMIN_FILE, JSON.stringify({ salt, passwordHash: passwordHashValue, sessionsValidAfter: Date.now() }));
    return;
  }
  const users = read();
  const index = users.findIndex((user) => user.username === username);
  if (index < 0) throw new Error('המשתמש לא נמצא');
  users[index] = { ...users[index], salt, passwordHash: passwordHashValue, sessionsValidAfter: Date.now() };
  save(users);
}

/** Defensive API-side check used after the lightweight edge middleware check. */
export function isSessionValid(username: string, role: 'admin' | 'user', issuedAt: number): boolean {
  if (role === 'admin') {
    if (username !== process.env.ADMIN_USERNAME) return false;
    return issuedAt >= (readAdminPassword()?.sessionsValidAfter ?? 0);
  }
  const user = read().find((item) => item.username === username);
  return Boolean(user && issuedAt >= (user.sessionsValidAfter ?? 0));
}
