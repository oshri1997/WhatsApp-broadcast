import type { Guest, SendJob } from '@/lib/types';
import { RSVP_QUESTION_MESSAGE } from '@/lib/templates';
import * as accounts from './accounts';
import * as guestStore from './guestStore';
import type { OutgoingMedia } from './whatsappClient';
import { singleton } from './singleton';

interface State {
  jobs: Map<string, SendJob>;
  nextId: number;
}

const state = singleton<State>('sendJobs', () => ({ jobs: new Map(), nextId: 1 }));

const MIN_DELAY_MS = 4000;
const MAX_DELAY_MS = 9000;
const LONG_PAUSE_EVERY = 25;
const LONG_PAUSE_MS = 30000;
// Gap between the invitation and the RSVP question that follows it, so they
// land as two distinct bubbles instead of racing each other.
const RSVP_FOLLOWUP_DELAY_MS = 2000;

export type SendTarget = Guest & { accountId: string };

function randomDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

export function renderMessage(template: string, guest: Pick<Guest, 'name' | 'customMessage'>) {
  const base = guest.customMessage?.trim() ? guest.customMessage : template;
  return base.replaceAll('{{שם}}', guest.name).replaceAll('{{name}}', guest.name);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createJob(
  guests: SendTarget[],
  messageTemplate: string,
  media: OutgoingMedia | null,
  sendRsvpQuestion: boolean
): string {
  const id = String(state.nextId++);
  const job: SendJob = {
    id,
    total: guests.length,
    sent: 0,
    failed: [],
    current: null,
    status: 'running',
  };
  state.jobs.set(id, job);

  runJob(job, guests, messageTemplate, media, sendRsvpQuestion).catch((err: Error) => {
    job.status = 'done';
    job.error = err.message;
  });

  return id;
}

async function runJob(
  job: SendJob,
  guests: SendTarget[],
  messageTemplate: string,
  media: OutgoingMedia | null,
  sendRsvpQuestion: boolean
) {
  for (let i = 0; i < guests.length; i++) {
    const guest = guests[i];
    job.current = guest.name;

    try {
      const text = renderMessage(messageTemplate, guest);
      await accounts.sendMessage(guest.accountId, guest.phone!, text, media);
      guestStore.update(guest.id, { invited: true });
      job.sent++;

      if (sendRsvpQuestion) {
        // The RSVP question is a separate message on purpose - if it fails,
        // the guest still got the invitation, so don't count that as a
        // failed send.
        await sleep(RSVP_FOLLOWUP_DELAY_MS);
        await accounts
          .sendMessage(guest.accountId, guest.phone!, RSVP_QUESTION_MESSAGE)
          .catch((err: Error) =>
            console.error(`Failed to send RSVP question to guest ${guest.id}:`, err.message)
          );
      }
    } catch (err) {
      job.failed.push({
        name: guest.name,
        phone: guest.phoneRaw || guest.phone || '',
        reason: (err as Error).message,
      });
    }

    const isLast = i === guests.length - 1;
    if (!isLast) {
      const delay = (i + 1) % LONG_PAUSE_EVERY === 0 ? LONG_PAUSE_MS : randomDelay();
      await sleep(delay);
    }
  }

  job.current = null;
  job.status = 'done';
}

export function getJob(id: string): SendJob | null {
  return state.jobs.get(id) ?? null;
}
