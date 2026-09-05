import fs from 'node:fs';
import path from 'node:path';
import { workspaceDataDir, workspaceExists } from '@/lib/server/dataDir';
import { list } from '@/lib/server/users';

const BETA_CAPACITY = 10;

type SendJobRecord = { createdAt?: string; completedAt?: string; status?: string };

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
