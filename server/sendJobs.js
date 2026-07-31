const whatsapp = require('./whatsappClient');

const jobs = new Map();
let nextJobId = 1;

const MIN_DELAY_MS = 4000;
const MAX_DELAY_MS = 9000;
const LONG_PAUSE_EVERY = 25;
const LONG_PAUSE_MS = 30000;

function randomDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

function renderMessage(template, guest) {
  return template
    .replaceAll('{{שם}}', guest.name)
    .replaceAll('{{name}}', guest.name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createJob(guests, messageTemplate) {
  const id = String(nextJobId++);
  const job = {
    id,
    total: guests.length,
    sent: 0,
    failed: [],
    current: null,
    status: 'running', // running | done
  };
  jobs.set(id, job);

  runJob(job, guests, messageTemplate).catch((err) => {
    job.status = 'done';
    job.error = err.message;
  });

  return id;
}

async function runJob(job, guests, messageTemplate) {
  for (let i = 0; i < guests.length; i++) {
    const guest = guests[i];
    job.current = guest.name;

    try {
      const text = renderMessage(messageTemplate, guest);
      await whatsapp.sendMessage(guest.phone, text);
      job.sent++;
    } catch (err) {
      job.failed.push({ name: guest.name, phone: guest.phoneRaw || guest.phone, reason: err.message });
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

function getJob(id) {
  return jobs.get(id) || null;
}

module.exports = { createJob, getJob };
