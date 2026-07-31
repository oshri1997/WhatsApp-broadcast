const { createAccount } = require('./whatsappClient');

const accounts = new Map(); // id -> { id, label, wa }
let nextAccountId = 1;

function create(label) {
  const id = 'acc' + nextAccountId++;
  const wa = createAccount(`.wwebjs_auth_${id}`);
  accounts.set(id, { id, label: label && label.trim() ? label.trim() : `חיבור ${id.replace('acc', '')}`, wa });
  wa.init();
  return id;
}

function ensureDefault() {
  if (accounts.size === 0) {
    create('אני');
  }
}

function list() {
  return Array.from(accounts.values()).map(({ id, label, wa }) => ({
    id,
    label,
    ...wa.getStatus(),
  }));
}

function rename(id, label) {
  const account = accounts.get(id);
  if (!account) return null;
  if (label && label.trim()) account.label = label.trim();
  return account;
}

async function remove(id) {
  const account = accounts.get(id);
  if (!account) return false;
  await account.wa.logout().catch(() => {});
  accounts.delete(id);
  return true;
}

async function logout(id) {
  const account = accounts.get(id);
  if (!account) throw new Error('חיבור לא נמצא');
  await account.wa.logout();
  account.wa.init();
}

function retryDisconnected() {
  for (const account of accounts.values()) {
    if (account.wa.getStatus().status === 'DISCONNECTED') {
      account.wa.init();
    }
  }
}

// Case/whitespace-insensitive match between a guest's "side" value and a
// configured account's label.
function findByLabel(label) {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  return Array.from(accounts.values()).find((a) => a.label.trim().toLowerCase() === normalized) || null;
}

function get(id) {
  return accounts.get(id) || null;
}

async function sendMessage(id, phone, text, image) {
  const account = accounts.get(id);
  if (!account) throw new Error('חשבון השליחה לא נמצא');
  await account.wa.sendMessage(phone, text, image);
}

module.exports = { create, ensureDefault, list, rename, remove, logout, retryDisconnected, findByLabel, get, sendMessage };
