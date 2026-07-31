const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const state = {
  status: 'INITIALIZING', // INITIALIZING | QR | AUTHENTICATED | READY | DISCONNECTED
  qrDataUrl: null,
  client: null,
};

function buildClient() {
  const puppeteerOptions = {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };

  if (process.env.CHROME_PATH) {
    puppeteerOptions.executablePath = process.env.CHROME_PATH;
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
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
    console.error('WhatsApp client failed to initialize:', err.message);
    state.status = 'DISCONNECTED';
    state.qrDataUrl = null;
    state.client = null;
  });
  return state.client;
}

function getStatus() {
  return { status: state.status, qrDataUrl: state.qrDataUrl };
}

async function sendMessage(phone, text) {
  const chatId = `${phone}@c.us`;
  const isRegistered = await state.client.isRegisteredUser(chatId);
  if (!isRegistered) {
    throw new Error('המספר אינו רשום בוואטסאפ');
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

module.exports = { init, getStatus, sendMessage, logout };
