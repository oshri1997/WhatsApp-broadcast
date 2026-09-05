import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Guest, SendFailure, SendJob } from '@/lib/types';
import * as accounts from './accounts';
import { workspaceDataDir, writeJsonAtomic } from './dataDir';
import * as guestStore from './guestStore';
import type { OutgoingMedia } from './whatsappClient';
import { singleton } from './singleton';

/** A running job is never resumed after restart, avoiding duplicate WhatsApps. */
export interface PersistedSendJob extends Omit<SendJob, 'status'> {
  status: SendJob['status'] | 'interrupted';
  createdAt: string;
  completedAt?: string;
  interruptedAt?: string;
}

interface WorkspaceState {
  jobs: Map<string, PersistedSendJob>;
}

interface State {
  workspaces: Map<string, WorkspaceState>;
}

const state = singleton<State>('sendJobs', () => ({ workspaces: new Map() }));
const MIN_DELAY_MS = 4000;
const MAX_DELAY_MS = 9000;
const LONG_PAUSE_EVERY = 25;
const LONG_PAUSE_MS = 30000;
const JOBS_FILENAME = 'send-jobs.json';

export type SendTarget = Guest & { accountId: string };

function jobsFile(workspaceId: string): string {
  return path.join(workspaceDataDir(workspaceId), JOBS_FILENAME);
}

function randomDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

function jobId() {
  return `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function readJobs(workspaceId: string): PersistedSendJob[] {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(jobsFile(workspaceId), 'utf8'));
    return Array.isArray(parsed) ? (parsed as PersistedSendJob[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to load send job history:', (error as Error).message);
    }
    return [];
  }
}

function persist(workspaceId: string, workspace: WorkspaceState): void {
  try {
    const file = jobsFile(workspaceId);
    writeJsonAtomic(file, [...workspace.jobs.values()]);
  } catch (error) {
    console.error('Failed to save send job history:', (error as Error).message);
  }
}

function workspaceState(workspaceId: string): WorkspaceState {
  const existing = state.workspaces.get(workspaceId);
  if (existing) return existing;

  const workspace: WorkspaceState = { jobs: new Map() };
  let changed = false;
  for (const job of readJobs(workspaceId)) {
    if (job.status === 'running') {
      job.status = 'interrupted';
      job.current = null;
      job.interruptedAt = new Date().toISOString();
      job.error = 'השליחה הופסקה בעקבות אתחול השרת. לא נשלחו הודעות נוספות כדי למנוע שליחה כפולה.';
      changed = true;
    }
    workspace.jobs.set(job.id, job);
  }
  state.workspaces.set(workspaceId, workspace);
  if (changed) persist(workspaceId, workspace);
  return workspace;
}

function updateJob(workspaceId: string, workspace: WorkspaceState, job: PersistedSendJob): void {
  workspace.jobs.set(job.id, job);
  persist(workspaceId, workspace);
}

function renderMessage(template: string, guest: Pick<Guest, 'name' | 'customMessage'>) {
  const base = guest.customMessage?.trim() ? guest.customMessage : template;
  return base.replaceAll('{{שם}}', guest.name).replaceAll('{{name}}', guest.name);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createJob(
  workspaceId: string,
  guests: SendTarget[],
  messageTemplate: string,
  media: OutgoingMedia | null
): string {
  const workspace = workspaceState(workspaceId);
  const job: PersistedSendJob = {
    id: jobId(),
    total: guests.length,
    sent: 0,
    failed: [],
    current: null,
    status: 'running',
    createdAt: new Date().toISOString(),
  };
  updateJob(workspaceId, workspace, job);

  void runJob(workspaceId, workspace, job, guests, messageTemplate, media).catch((error: Error) => {
    job.status = 'done';
    job.current = null;
    job.completedAt = new Date().toISOString();
    job.error = error.message;
    updateJob(workspaceId, workspace, job);
  });
  return job.id;
}

async function runJob(
  workspaceId: string,
  workspace: WorkspaceState,
  job: PersistedSendJob,
  guests: SendTarget[],
  messageTemplate: string,
  media: OutgoingMedia | null
) {
  for (let i = 0; i < guests.length; i++) {
    const guest = guests[i];
    job.current = guest.name;
    updateJob(workspaceId, workspace, job);
    try {
      await accounts.sendMessage(workspaceId, guest.accountId, guest.phone!, renderMessage(messageTemplate, guest), media);
      guestStore.update(workspaceId, guest.id, { invited: true });
      job.sent++;
    } catch (error) {
      const failure: SendFailure = {
        name: guest.name,
        phone: guest.phoneRaw || guest.phone || '',
        reason: (error as Error).message,
      };
      job.failed.push(failure);
    }
    updateJob(workspaceId, workspace, job);
    if (i !== guests.length - 1) {
      await sleep((i + 1) % LONG_PAUSE_EVERY === 0 ? LONG_PAUSE_MS : randomDelay());
    }
  }
  job.current = null;
  job.status = 'done';
  job.completedAt = new Date().toISOString();
  updateJob(workspaceId, workspace, job);
}

export function getJob(workspaceId: string, id: string): PersistedSendJob | null {
  return workspaceState(workspaceId).jobs.get(id) ?? null;
}

/** Newest first; cap history output for beta clients. */
export function listJobs(workspaceId: string, limit = 50): PersistedSendJob[] {
  return [...workspaceState(workspaceId).jobs.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(1, Math.min(limit, 200)));
}
