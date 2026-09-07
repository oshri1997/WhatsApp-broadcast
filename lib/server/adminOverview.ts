import fs from 'node:fs';
import path from 'node:path';
import { workspaceDataDir, workspaceExists } from '@/lib/server/dataDir';
import { list } from '@/lib/server/users';

const BETA_CAPACITY = 10;

type SendJobRecord = { createdAt?: string; completedAt?: string; status?: 'running' | 'done' | 'interrupted'; sent?: number; failed?: unknown[] };
type AccountRecord = { id?: string; label?: string };

function readArray(file: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function workspaceSummary(username: string) {
  if (!workspaceExists(username)) {
    return { hasWorkspace: false, guests: 0, sends: 0, lastActivityAt: null as string | null };
  }
  const directory = workspaceDataDir(username);
  const guests = readArray(path.join(directory, 'guests.json'));
  const jobs = readArray(path.join(directory, 'send-jobs.json')) as SendJobRecord[];
  const timestamps = jobs.flatMap((job) => [job.completedAt, job.createdAt]).filter((value): value is string => Boolean(value));
  return {
    hasWorkspace: true,
    guests: guests.length,
    sends: jobs.length,
    lastActivityAt: timestamps.sort().at(-1) ?? null,
  };
}

/** A privacy-safe, admin-only snapshot for helping a beta couple. No text,
 * phone numbers, QR payloads, WhatsApp credentials, or invitation media are read. */
export function getUserMonitor(username: string) {
  const user = list().find((candidate) => candidate.username === username);
  if (!user) return null;

  const summary = workspaceSummary(username);
  if (!summary.hasWorkspace) {
    return {
      user,
      ...summary,
      connections: 0,
      completedJobs: 0,
      runningJobs: 0,
      interruptedJobs: 0,
      sentMessages: 0,
      failedMessages: 0,
      hasInvitationMedia: false,
    };
  }

  const directory = workspaceDataDir(username);
  const jobs = readArray(path.join(directory, 'send-jobs.json')) as SendJobRecord[];
  const connections = readArray(path.join(directory, 'accounts.json')) as AccountRecord[];
  return {
    user,
    ...summary,
    connections: connections.length,
    completedJobs: jobs.filter((job) => job.status === 'done').length,
    runningJobs: jobs.filter((job) => job.status === 'running').length,
    interruptedJobs: jobs.filter((job) => job.status === 'interrupted').length,
    sentMessages: jobs.reduce((total, job) => total + (Number.isFinite(job.sent) ? job.sent! : 0), 0),
    failedMessages: jobs.reduce((total, job) => total + (Array.isArray(job.failed) ? job.failed.length : 0), 0),
    hasInvitationMedia: fs.existsSync(path.join(directory, 'invitation-media.bin')),
  };
}

/** Read-only, aggregate beta telemetry. Never reads message content or credentials. */
export function getAdminOverview() {
  const users = list().map((user) => ({ ...user, ...workspaceSummary(user.username) }));
  const activeWorkspaces = users.filter((user) => user.hasWorkspace).length;
  return {
    betaCapacity: BETA_CAPACITY,
    users,
    metrics: {
      registeredUsers: users.length,
      availableSeats: Math.max(0, BETA_CAPACITY - users.length),
      activeWorkspaces,
      totalGuests: users.reduce((total, user) => total + user.guests, 0),
      totalSendJobs: users.reduce((total, user) => total + user.sends, 0),
    },
  };
}
