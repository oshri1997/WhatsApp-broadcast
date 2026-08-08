import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import type { AccountStatus } from '@/lib/types';

export interface IncomingMessage {
  chatId: string;
  phone: string;
  body: string;
}

export interface OutgoingMedia {
  data: string; // base64
  mimetype: string;
  filename: string;
}

export interface WhatsAppAccount {
  init(): void;
  getStatus(): { status: AccountStatus; qrDataUrl: string | null; phone: string | null };
  sendMessage(phone: string, text: string, media?: OutgoingMedia | null): Promise<void>;
  sendRaw(chatId: string, text: string): Promise<void>;
  logout(): Promise<void>;
  shutdown(): Promise<void>;
}

// Builds one independent WhatsApp Web connection. Each account gets its own
// LocalAuth session folder (keyed by dataPath) so multiple phone numbers can
// be logged in side by side, each with its own QR code. `onMessage` is invoked
// for every message this account receives (not ones it sends), used for the
// RSVP reply flow.
export function createAccount(
  dataPath: string,
  onMessage?: (message: IncomingMessage) => void
): WhatsAppAccount {
  const state: {
    status: AccountStatus;
    qrDataUrl: string | null;
    /** Which phone number this session is actually linked to, once ready. */
    phone: string | null;
    client: Client | null;
  } = {
    status: 'INITIALIZING',
    qrDataUrl: null,
    phone: null,
    client: null,
  };

  function buildClient(): Client {
    const args = ['--no-sandbox', '--disable-setuid-sandbox'];

    // Chromium does not read the HTTPS_PROXY env var on its own - it needs an
    // explicit --proxy-server flag (relevant on machines/networks that require
    // an outbound proxy).
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (proxy) {
      args.push(`--proxy-server=${proxy}`);
    }

    const puppeteerOptions: { args: string[]; executablePath?: string } = { args };

    if (process.env.CHROME_PATH) {
      puppeteerOptions.executablePath = process.env.CHROME_PATH;
    }

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath }),
      puppeteer: puppeteerOptions,
    });

    client.on('qr', async (qr: string) => {
      state.status = 'QR';
      state.qrDataUrl = await qrcode.toDataURL(qr);
    });

    client.on('authenticated', () => {
      state.status = 'AUTHENTICATED';
      state.qrDataUrl = null;
    });

    client.on('ready', () => {
      state.status = 'READY';
      state.qrDataUrl = null;
      // A restored session says nothing about *which* phone it belongs to, so
      // surface the linked number - otherwise you can only find out by sending.
      state.phone = client.info?.wid?.user ?? null;
    });

    client.on('disconnected', () => {
      state.status = 'DISCONNECTED';
      state.qrDataUrl = null;
      state.phone = null;
      state.client = null;
    });

    client.on('auth_failure', () => {
      state.status = 'DISCONNECTED';
      state.qrDataUrl = null;
      state.phone = null;
      state.client = null;
    });

    if (onMessage) {
      client.on('message', async (message) => {
        // Only handle direct 1:1 chats - a real guest is always addressed as
        // @c.us (phone-based) or @lid (WhatsApp's privacy ID). Everything
        // else (@g.us groups, @newsletter channels, @broadcast/status, and
        // any future chat type) has no single phone number to match against
        // a guest, so skip it outright rather than trying and failing to
        // resolve one.
        if (!/@(c\.us|lid)$/.test(message.from)) return;

        console.log(`WhatsApp client (${dataPath}) received a message from ${message.from}`);
        try {
          // message.from isn't always a phone number - WhatsApp increasingly
          // addresses chats by an opaque "LID" instead of <phone>@c.us.
          // Contact.number is not reliable for resolving the real number in
          // that case (it can just echo the LID back unresolved), so ask
          // WhatsApp's own lid<->phone mapping directly.
          const mapping = (await (
            client as unknown as {
              getContactLidAndPhone(ids: string[]): Promise<{ pn?: string }[]>;
            }
          ).getContactLidAndPhone([message.from]))[0];

          if (!mapping?.pn) {
            console.error(`Could not resolve a phone number for ${message.from} - skipping.`);
            return;
          }
          const phone = mapping.pn.replace(/@.*$/, '');
          onMessage({ chatId: message.from, phone, body: message.body });
        } catch (err) {
          console.error(
            `Failed to resolve sender for incoming message (${dataPath}):`,
            (err as Error).message
          );
        }
      });
    }

    return client;
  }

  function init() {
    if (state.client) return;
    const client = (state.client = buildClient());
    client.initialize().catch(async (err: Error) => {
      console.error(`WhatsApp client (${dataPath}) failed to initialize:`, err.message);
      // A failed initialize() can still leave the underlying Chromium process
      // (and its profile lock) running, which makes every subsequent init()
      // attempt fail with an unrelated "browser already running" error instead
      // of retrying cleanly. Close it down so the lock is released.
      await client.destroy().catch(() => {});
      state.status = 'DISCONNECTED';
      state.qrDataUrl = null;
      state.client = null;
    });
  }

  function getStatus() {
    // Read client.info live rather than trusting the value captured on
    // 'ready': the event fires once, and a session restored from disk can
    // reach READY before anything is listening.
    if (state.status === 'READY' && !state.phone) {
      state.phone = state.client?.info?.wid?.user ?? null;
    }
    return { status: state.status, qrDataUrl: state.qrDataUrl, phone: state.phone };
  }

  async function sendMessage(phone: string, text: string, media?: OutgoingMedia | null) {
    if (!state.client || state.status !== 'READY') {
      throw new Error('החשבון הזה עדיין לא מחובר לוואטסאפ');
    }

    // getNumberId asks WhatsApp for the number's *current* canonical id and
    // returns null if unregistered. WhatsApp increasingly addresses contacts
    // by an opaque "lid" rather than <phone>@c.us (the same reason incoming
    // messages need getContactLidAndPhone), so building the c.us address by
    // hand and sending to that instead of the resolved id can silently target
    // a chat that doesn't exist: no error, no chat ever opens on their phone.
    const numberId = await state.client.getNumberId(phone);
    if (!numberId) {
      throw new Error('המספר אינו רשום בוואטסאפ');
    }
    // _serialized is a getter on WhatsApp's internal wid objects computed
    // in-browser; whatsapp-web.js's own lid-resolution helper explicitly
    // reads it *inside* the puppeteer evaluate() call for exactly this reason
    // - getNumberId doesn't, so it can come back empty once the raw wid
    // crosses back out to Node. `user`/`server` are plain string fields set
    // directly on the object, so they survive that trip; reconstruct from
    // them rather than trust a getter that might not have.
    const chatId = numberId._serialized || `${numberId.user}@${numberId.server}`;

    if (media) {
      const messageMedia = new MessageMedia(media.mimetype, media.data, media.filename);
      await state.client.sendMessage(chatId, messageMedia, { caption: text });
    } else {
      await state.client.sendMessage(chatId, text);
    }
  }

  // Replies directly to an existing chat by its own chat ID, unlike
  // sendMessage which builds a fresh <phone>@c.us address - needed for RSVP
  // replies since the original chat may be addressed by a LID rather than the
  // phone number.
  async function sendRaw(chatId: string, text: string) {
    if (!state.client || state.status !== 'READY') {
      throw new Error('החשבון הזה עדיין לא מחובר לוואטסאפ');
    }
    await state.client.sendMessage(chatId, text);
  }

  async function logout() {
    if (state.client) {
      await state.client.logout();
      state.client = null;
      state.status = 'INITIALIZING';
      state.qrDataUrl = null;
      state.phone = null;
    }
  }

  // Closes the puppeteer browser without touching the linked WhatsApp session -
  // unlike logout(), which deliberately unlinks the device and deletes the
  // session files. Killing the process without this leaves Chromium's profile
  // (its IndexedDB, specifically - where the login keys live) mid-write, which
  // can corrupt it and force a fresh QR scan on the next launch even though
  // the session folder is still sitting on disk.
  async function shutdown() {
    if (state.client) {
      await state.client.destroy().catch(() => {});
      state.client = null;
    }
  }

  return { init, getStatus, sendMessage, sendRaw, logout, shutdown };
}
