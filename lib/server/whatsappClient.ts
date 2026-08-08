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
  diagnose(phone: string): Promise<unknown>;
  testSend(phone: string, text: string): Promise<unknown>;
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

  /**
   * Makes sure WhatsApp Web has a real Chat object for this number before we
   * try to send.
   *
   * client.sendMessage() bails out with `undefined` when its internal
   * `getChat()` can't produce a chat, and that lookup only ever tries the
   * exact wid string we hand it. For a contact WhatsApp has migrated to
   * lid-based addressing, `<phone>@c.us` doesn't resolve and neither does a
   * bare lid on its own - so the send silently does nothing and no chat is
   * ever created on the sender's phone.
   *
   * Doing the resolution in-page lets us ask WhatsApp for the contact's
   * current lid/phone pair and try each candidate wid against its own chat
   * store, returning the first that actually yields a Chat. Returns the wid
   * string to send to, or null if the number genuinely isn't reachable.
   */
  async function resolveChatId(phone: string): Promise<string | null> {
    const page = (state.client as unknown as { pupPage: import('puppeteer').Page }).pupPage;

    return page.evaluate(async (phoneNumber: string) => {
      type Wid = { server: string; user: string; _serialized: string };
      const w = window as unknown as {
        require: (m: string) => Record<string, (...args: unknown[]) => unknown>;
        WWebJS: Record<string, (...args: unknown[]) => unknown>;
      };

      const candidates: string[] = [];
      const push = (wid: Wid | null | undefined) => {
        const id = wid?._serialized;
        if (id && !candidates.includes(id)) candidates.push(id);
      };

      const base = `${phoneNumber}@c.us`;

      // Ask WhatsApp whether the number exists at all, and for the wid it
      // considers canonical - that is what a lid-migrated contact needs.
      try {
        const result = (await w
          .require('WAWebQueryExistsJob')
          .queryWidExists(w.require('WAWebWidFactory').createWid(base))) as { wid?: Wid } | null;
        if (!result?.wid) return null; // not on WhatsApp
        push(result.wid);
      } catch {
        // Fall through to the plain address; the query is an optimization.
      }

      try {
        const pair = (await w.WWebJS.enforceLidAndPnRetrieval(base)) as {
          lid?: Wid;
          phone?: Wid;
        };
        push(pair?.phone);
        push(pair?.lid);
      } catch {
        /* older/newer library shapes - the candidates below still apply */
      }

      push(w.require('WAWebWidFactory').createWid(base) as Wid);

      for (const candidate of candidates) {
        try {
          const chat = await w.WWebJS.getChat(candidate, { getAsModel: false });
          if (chat) return candidate;
        } catch {
          /* try the next candidate */
        }
      }
      return null;
    }, phone);
  }

  async function sendMessage(phone: string, text: string, media?: OutgoingMedia | null) {
    if (!state.client || state.status !== 'READY') {
      throw new Error('החשבון הזה עדיין לא מחובר לוואטסאפ');
    }

    const chatId = await resolveChatId(phone);
    if (!chatId) {
      throw new Error('המספר אינו רשום בוואטסאפ');
    }

    let sent;
    if (media) {
      const messageMedia = new MessageMedia(media.mimetype, media.data, media.filename);
      sent = await state.client.sendMessage(chatId, messageMedia, { caption: text });
    } else {
      sent = await state.client.sendMessage(chatId, text);
    }
    if (!sent) {
      // sendMessage() resolves with undefined rather than throwing when the
      // send doesn't go through. Never report that as success.
      throw new Error('השליחה לא הושלמה בוואטסאפ - ייתכן שהמספר לא ניתן לשליחה מהחשבון הזה כרגע');
    }
  }

  /**
   * Reports what WhatsApp Web knows about a number: whether it exists, its
   * lid/phone pair, and which candidate wids actually resolve to a chat.
   * Used by /api/debug/number to diagnose "reports sent but never arrives".
   */
  async function diagnose(phone: string): Promise<unknown> {
    if (!state.client || state.status !== 'READY') {
      throw new Error('החשבון הזה עדיין לא מחובר לוואטסאפ');
    }
    const page = (state.client as unknown as { pupPage: import('puppeteer').Page }).pupPage;

    return page.evaluate(async (phoneNumber: string) => {
      type Wid = { server: string; user: string; _serialized: string };
      const w = window as unknown as {
        require: (m: string) => Record<string, (...args: unknown[]) => unknown>;
        WWebJS: Record<string, (...args: unknown[]) => unknown>;
      };
      const base = `${phoneNumber}@c.us`;
      const report: Record<string, unknown> = { input: base };

      try {
        const result = (await w
          .require('WAWebQueryExistsJob')
          .queryWidExists(w.require('WAWebWidFactory').createWid(base))) as { wid?: Wid } | null;
        report.queryWidExists = result?.wid?._serialized ?? null;
      } catch (err) {
        report.queryWidExists = `ERROR: ${(err as Error).message}`;
      }

      try {
        const pair = (await w.WWebJS.enforceLidAndPnRetrieval(base)) as {
          lid?: Wid;
          phone?: Wid;
        };
        report.lid = pair?.lid?._serialized ?? null;
        report.phone = pair?.phone?._serialized ?? null;
      } catch (err) {
        report.lidLookup = `ERROR: ${(err as Error).message}`;
      }

      // Which "me" identities this account actually has. WWebJS.sendMessage
      // picks `from = chat.id.isLid() ? lidUser : meUser` - so a chat that is
      // lid-addressed while the account has no lid user yields a message key
      // with an empty sender, and the send goes nowhere without throwing.
      try {
        const me = w.require('WAWebUserPrefsMeUser') as unknown as {
          getMaybeMeLidUser(): Wid | null;
          getMaybeMePnUser(): Wid | null;
        };
        report.meLidUser = me.getMaybeMeLidUser()?._serialized ?? null;
        report.mePnUser = me.getMaybeMePnUser()?._serialized ?? null;
      } catch (err) {
        report.meUserLookup = `ERROR: ${(err as Error).message}`;
      }

      const tried: Record<string, unknown> = {};
      for (const candidate of [report.queryWidExists, report.phone, report.lid, base]) {
        if (typeof candidate !== 'string' || tried[candidate]) continue;
        try {
          const wid = w.require('WAWebWidFactory').createWid(candidate) as Wid;
          const collections = w.require('WAWebCollections') as unknown as {
            Chat: { get(wid: Wid): unknown };
          };

          // Distinguish a chat that already exists in WhatsApp's store from one
          // findOrCreateLatestChat conjures on the spot: sending appears to
          // work only for the former, and a chat stub that never lands in the
          // collection would explain a send that neither errors nor delivers.
          const existingBefore = !!collections.Chat.get(wid);
          const created = (await (
            w.require('WAWebFindChatAction') as unknown as {
              findOrCreateLatestChat(wid: Wid): Promise<{ chat?: unknown } | null>;
            }
          ).findOrCreateLatestChat(wid)) as { chat?: { id?: Wid; msgs?: { models?: unknown[] } } } | null;

          tried[candidate] = {
            existedBeforeLookup: existingBefore,
            findOrCreateReturnedChat: !!created?.chat,
            registeredInCollectionAfter: !!collections.Chat.get(wid),
            actualChatId: created?.chat?.id?._serialized ?? null,
            loadedMessages: created?.chat?.msgs?.models?.length ?? null,
          };
        } catch (err) {
          tried[candidate] = `ERROR: ${(err as Error).message}`;
        }
      }
      report.chatResolution = tried;
      return report;
    }, phone);
  }

  /**
   * Sends one real message and reports what actually landed in WhatsApp's own
   * message store afterwards.
   *
   * client.sendMessage() returns `Msg.get(newMsgKey)` - a local lookup by the
   * key it minted before sending - so `undefined` is ambiguous: it means
   * either "the send never happened" or "it happened but got stored under a
   * different key". Reading the chat's messages back distinguishes the two,
   * and the ack tells us whether the server accepted it (0 = pending/not sent,
   * 1 = reached server, 2 = delivered to device).
   */
  async function testSend(phone: string, text: string): Promise<unknown> {
    if (!state.client || state.status !== 'READY') {
      throw new Error('החשבון הזה עדיין לא מחובר לוואטסאפ');
    }

    const chatId = await resolveChatId(phone);
    if (!chatId) throw new Error('המספר אינו רשום בוואטסאפ');

    // addAndSendMsgToChat returns [msgPromise, sendMsgResultPromise] and the
    // library only awaits the first unless waitUntilMsgSent is set - so a
    // failure in the actual transmission is left in an unobserved promise and
    // never surfaces. Force the wait so the real error can be seen.
    let returned: unknown;
    let sendError: string | null = null;
    try {
      returned = await state.client.sendMessage(chatId, text, { waitUntilMsgSent: true });
    } catch (err) {
      sendError = (err as Error).message;
    }
    const page = (state.client as unknown as { pupPage: import('puppeteer').Page }).pupPage;

    // Give WhatsApp a moment to register the outgoing message and its ack.
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const stored = await page.evaluate(
      async (id: string, body: string) => {
        const w = window as unknown as {
          require: (m: string) => Record<string, (...args: unknown[]) => unknown>;
          WWebJS: Record<string, (...args: unknown[]) => unknown>;
        };
        const chat = (await w.WWebJS.getChat(id, { getAsModel: false })) as {
          msgs?: { models?: unknown[] };
        } | null;
        if (!chat) return { chat: null };

        const models = (chat.msgs?.models ?? []) as {
          id?: { _serialized?: string };
          body?: string;
          ack?: number;
          from?: { _serialized?: string };
          to?: { _serialized?: string };
        }[];

        return {
          chat: id,
          totalMessages: models.length,
          matching: models
            .filter((m) => m.body === body)
            .map((m) => ({
              id: m.id?._serialized ?? null,
              ack: m.ack ?? null,
              from: m.from?._serialized ?? null,
              to: m.to?._serialized ?? null,
            })),
          lastThree: models.slice(-3).map((m) => ({
            id: m.id?._serialized ?? null,
            body: (m.body ?? '').slice(0, 40),
            ack: m.ack ?? null,
          })),
        };
      },
      chatId,
      text
    );

    return {
      chatId,
      sendError,
      sendMessageReturned: returned ? 'Message object' : String(returned),
      stored,
    };
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

  return { init, getStatus, sendMessage, sendRaw, logout, shutdown, diagnose, testSend };
}
