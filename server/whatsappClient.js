const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// Builds one independent WhatsApp Web connection. Each account gets its own
// LocalAuth session folder (keyed by dataPath) so multiple phone numbers can
// be logged in side by side, each with its own QR code.
function createAccount(dataPath) {
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

    return client;
  }

  function init() {
    if (state.client) return state.client;
    state.client = buildClient();
    state.client.initialize().catch((err) => {
      console.error(`WhatsApp client (${dataPath}) failed to initialize:`, err.message);
      state.status = 'DISCONNECTED';
      state.qrDataUrl = null;
      state.client = null;
    });
    return state.client;
  }

  function getStatus() {
    return { status: state.status, qrDataUrl: state.qrDataUrl };
  }

  async function sendMessage(phone, text, image) {
    if (!state.client || state.status !== 'READY') {
      throw new Error('החשבון הזה עדיין לא מחובר לוואטסאפ');
    }

    const chatId = `${phone}@c.us`;
    const isRegistered = await state.client.isRegisteredUser(chatId);
    if (!isRegistered) {
      throw new Error('המספר אינו רשום בוואטסאפ');
    }

    if (image) {
      const media = new MessageMedia(image.mimetype, image.data, image.filename);
      await state.client.sendMessage(chatId, media, { caption: text });
    } else {
      await state.client.sendMessage(chatId, text);
    }
  }

  async function logout() {
    if (state.client) {
      await state.client.logout();
      state.client = null;
      state.status = 'INITIALIZING';
      state.qrDataUrl = null;
    }
  }

  return { init, getStatus, sendMessage, logout };
}

module.exports = { createAccount };
