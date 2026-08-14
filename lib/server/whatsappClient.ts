import fs from 'node:fs';
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

// Baileys (@whiskeysockets/baileys) is ESM-only, so it's loaded via dynamic
// import from this CommonJS-compiled module. Node caches the module after
// the first import, so repeated calls are cheap.
function loadBaileys() {
  return import('@whiskeysockets/baileys');
}

async function buildProxyAgent() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return undefined;
  const { HttpsProxyAgent } = await import('https-proxy-agent');
  return new HttpsProxyAgent(proxy);
}

// Builds one independent WhatsApp connection over a direct WebSocket (no
// browser involved). Each account gets its own auth folder (keyed by
// dataPath) so multiple phone numbers can be logged in side by side, each
// with its own QR code. `onMessage` is invoked for every message this
// account receives (not ones it sends), used for the RSVP reply flow.
export function createAccount(
  dataPath: string,
  onMessage?: (message: IncomingMessage) => void
): WhatsAppAccount {
  const state: {
    status: AccountStatus;
    qrDataUrl: string | null;
    /** Which phone number this session is actually linked to, once ready. */
    phone: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sock: any;
  } = {
    status: 'INITIALIZING',
    qrDataUrl: null,
    phone: null,
    sock: null,
  };

  async function connect() {
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await loadBaileys();
    const { default: pino } = await import('pino');

    const { state: authState, saveCreds } = await useMultiFileAuthState(dataPath);

    const sock = makeWASocket({
      auth: authState,
      logger: pino({ level: 'silent' }),
      agent: await buildProxyAgent(),
    });
    state.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    // A connection attempt that never reaches 'open' can also never fire a
    // 'close' event (observed with a broken/rejecting proxy tunnel: the
    // underlying WebSocket just hangs with no error surfaced at all) -
    // without this, the account would be stuck showing "initializing"
    // forever with no retry, since retries only trigger once status becomes
    // DISCONNECTED. Force it closed if it hasn't resolved either way in
    // time; sock.end() itself emits the normal 'close' update, so the
    // regular handler below still runs and does the retry-eligible cleanup.
    const connectTimeout = setTimeout(() => {
      sock.end(new Error('החיבור לוואטסאפ נתקע (timeout) - מנסה שוב'));
    }, 30_000);

    sock.ev.on('connection.update', async (update: Record<string, unknown>) => {
      const connection = update.connection as string | undefined;
      const qr = update.qr as string | undefined;
      const lastDisconnect = update.lastDisconnect as
        | { error?: { message?: string; output?: { statusCode?: number } } }
        | undefined;

      if (qr) {
        // Reaching a QR challenge already proves the socket connected fine -
        // the rest of the wait is just for the user to grab their phone, so
        // the connect-attempt timeout no longer applies.
        clearTimeout(connectTimeout);
        state.status = 'QR';
        state.qrDataUrl = await qrcode.toDataURL(qr);
      }

      // Baileys fires 'connecting' at the very start of every attempt,
      // including a fresh/never-paired one - so it only means "authenticated
      // and re-establishing the session" if we were previously showing a QR
      // (i.e. the phone just scanned it). Otherwise leave the status as-is
      // (INITIALIZING) until something more conclusive happens.
      if (connection === 'connecting' && state.status === 'QR') {
        state.status = 'AUTHENTICATED';
      }

      if (connection === 'open') {
        clearTimeout(connectTimeout);
        state.status = 'READY';
        state.qrDataUrl = null;
        state.phone = sock.user?.id ? String(sock.user.id).replace(/[:@].*$/, '') : null;
      }

      if (connection === 'close') {
        clearTimeout(connectTimeout);
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        console.error(
          `WhatsApp client (${dataPath}) disconnected:`,
          lastDisconnect?.error?.message || lastDisconnect?.error || 'unknown reason'
        );

        state.status = 'DISCONNECTED';
        state.qrDataUrl = null;
        state.phone = null;
        state.sock = null;

        if (loggedOut) {
          // Stale session on WhatsApp's side too - clear it locally so the
          // next connect attempt requests a fresh QR instead of retrying
          // credentials WhatsApp has already discarded.
          await fs.promises.rm(dataPath, { recursive: true, force: true }).catch(() => {});
        }
      }
    });

    if (onMessage) {
      sock.ev.on('messages.upsert', ({ messages }: { messages: Array<Record<string, any>> }) => {
        for (const message of messages) {
          if (message.key.fromMe) continue;

          const remoteJid: string = message.key.remoteJid || '';
          // Only handle direct 1:1 chats - a real guest is always addressed
          // as @s.whatsapp.net (phone-based) or @lid (WhatsApp's privacy
          // ID). Everything else (@g.us groups, @newsletter channels,
          // @broadcast/status) has no single phone number to match against
          // a guest.
          if (!/@(s\.whatsapp\.net|lid)$/.test(remoteJid)) continue;

          const body: string =
            message.message?.conversation || message.message?.extendedTextMessage?.text || '';
          if (!body) continue;

          // Baileys exposes the phone-number address directly on the
          // message key: if the chat is LID-addressed, remoteJidAlt carries
          // the corresponding phone JID (and vice versa) - no extra network
          // round-trip needed to resolve it.
          const phoneJid: string | undefined = remoteJid.endsWith('@lid')
            ? message.key.remoteJidAlt
            : remoteJid;
          if (!phoneJid) {
            console.error(`Could not resolve a phone number for ${remoteJid} - skipping.`);
            continue;
          }

          const phone = phoneJid.replace(/@.*$/, '');
          onMessage({ chatId: remoteJid, phone, body });
        }
      });
    }
  }

  function init() {
    if (state.sock) return;
    connect().catch((err: Error) => {
      console.error(`WhatsApp client (${dataPath}) failed to initialize:`, err.message);
      state.status = 'DISCONNECTED';
      state.qrDataUrl = null;
      state.sock = null;
    });
  }

  function getStatus() {
    return { status: state.status, qrDataUrl: state.qrDataUrl, phone: state.phone };
  }

  async function sendMessage(phone: string, text: string, media?: OutgoingMedia | null) {
    if (!state.sock || state.status !== 'READY') {
      throw new Error('החשבון הזה עדיין לא מחובר לוואטסאפ');
    }

    const [result] = (await state.sock.onWhatsApp(phone)) || [];
    if (!result?.exists) {
      throw new Error('המספר אינו רשום בוואטסאפ');
    }

    const jid = result.jid;
    let sent;
    if (media) {
      const buffer = Buffer.from(media.data, 'base64');
      const content = media.mimetype.startsWith('video/')
        ? { video: buffer, caption: text, mimetype: media.mimetype }
        : { image: buffer, caption: text, mimetype: media.mimetype };
      sent = await state.sock.sendMessage(jid, content);
    } else {
      sent = await state.sock.sendMessage(jid, { text });
    }
    if (!sent) {
      // sendMessage() can resolve with undefined rather than throwing when
      // the send doesn't go through. Never report that as success.
      throw new Error('השליחה לא הושלמה בוואטסאפ - ייתכן שהמספר לא ניתן לשליחה מהחשבון הזה כרגע');
    }
  }

  // Replies directly to an existing chat by its own chat ID, unlike
  // sendMessage which resolves a fresh address from a phone number - needed
  // for RSVP replies since the original chat may be addressed by a LID.
  async function sendRaw(chatId: string, text: string) {
    if (!state.sock || state.status !== 'READY') {
      throw new Error('החשבון הזה עדיין לא מחובר לוואטסאפ');
    }
    await state.sock.sendMessage(chatId, { text });
  }

  async function logout() {
    if (state.sock) {
      await state.sock.logout().catch(() => {});
      state.sock = null;
    }
    await fs.promises.rm(dataPath, { recursive: true, force: true }).catch(() => {});
    state.status = 'INITIALIZING';
    state.qrDataUrl = null;
    state.phone = null;
  }

  // Closes the socket without touching the linked WhatsApp session - unlike
  // logout(), which deliberately unlinks the device and deletes the session
  // files. Used on process shutdown so a bare Ctrl+C doesn't leave the
  // connection in a half-closed state.
  async function shutdown() {
    if (state.sock) {
      await state.sock.end(undefined);
      state.sock = null;
    }
  }

  return { init, getStatus, sendMessage, sendRaw, logout, shutdown };
}
