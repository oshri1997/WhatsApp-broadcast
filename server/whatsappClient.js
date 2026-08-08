const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// Builds one independent WhatsApp Web connection. Each account gets its own
// LocalAuth session folder (keyed by dataPath) so multiple phone numbers can
// be logged in side by side, each with its own QR code. `onMessage(chatId,
// body)` is invoked for every message this account receives (not ones it
// sends), used for the RSVP reply flow.
function createAccount(dataPath, onMessage) {
  const state = {
    status: 'INITIALIZING', // INITIALIZING | QR | AUTHENTICATED | READY | DISCONNECTED
    qrDataUrl: null,
    client: null,
  };

  function buildClient() {
    const args = ['--no-sandbox', '--disable-setuid-sandbox'];

    // Chromium does not read the HTTPS_PROXY env var on its own - it needs an
    // explicit --proxy-server flag (relevant on machines/networks that require
    // an outbound proxy).
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (proxy) {
      args.push(`--proxy-server=${proxy}`);
    }

    const puppeteerOptions = { args };

    if (process.env.CHROME_PATH) {
      puppeteerOptions.executablePath = process.env.CHROME_PATH;
    }

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath }),
      puppeteer: puppeteerOptions,
    });

    client.on('qr', async (qr) => {
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
    });

    client.on('disconnected', () => {
      state.status = 'DISCONNECTED';
      state.qrDataUrl = null;
      state.client = null;
    });

    client.on('auth_failure', () => {
      state.status = 'DISCONNECTED';
      state.qrDataUrl = null;
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
          const [{ pn }] = await client.getContactLidAndPhone([message.from]);
          if (!pn) {
            console.error(`Could not resolve a phone number for ${message.from} - skipping.`);
            return;
          }
          const phone = pn.replace(/@.*$/, '');
          onMessage({ chatId: message.from, phone, body: message.body });
        } catch (err) {
          console.error(`Failed to resolve sender for incoming message (${dataPath}):`, err.message);
        }
      });
    }

    return client;
  }

  function init() {
    if (state.client) return state.client;
    const client = (state.client = buildClient());
    client.initialize().catch(async (err) => {
      console.error(`WhatsApp client (${dataPath}) failed to initialize:`, err.message);
      // A failed initialize() can still leave the underlying Chromium
      // process (and its profile lock) running, which makes every
      // subsequent init() attempt fail with an unrelated "browser already
      // running" error instead of retrying cleanly. Close it down so the
      // lock is released.
      await client.destroy().catch(() => {});
      state.status = 'DISCONNECTED';
      state.qrDataUrl = null;
      state.client = null;
    });
    return state.client;
  }

  function getStatus() {
    return { status: state.status, qrDataUrl: state.qrDataUrl };
  }

  async function sendMessage(phone, text, media) {
    if (!state.client || state.status !== 'READY') {
      throw new Error('החשבון הזה עדיין לא מחובר לוואטסאפ');
    }

    const chatId = `${phone}@c.us`;
    const isRegistered = await state.client.isRegisteredUser(chatId);
    if (!isRegistered) {
      throw new Error('המספר אינו רשום בוואטסאפ');
    }

    if (media) {
      const messageMedia = new MessageMedia(media.mimetype, media.data, media.filename);
      await state.client.sendMessage(chatId, messageMedia, { caption: text });
    } else {
      await state.client.sendMessage(chatId, text);
    }
  }

  // Replies directly to an existing chat by its own chat ID, unlike
  // sendMessage which builds a fresh <phone>@c.us address - needed for RSVP
  // replies since the original chat may be addressed by a LID rather than
  // the phone number.
  async function sendRaw(chatId, text) {
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
    }
  }

  return { init, getStatus, sendMessage, sendRaw, logout };
}

module.exports = { createAccount };
