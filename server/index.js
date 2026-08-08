const path = require('path');
const express = require('express');
const multer = require('multer');

// whatsapp-web.js drives a real browser under the hood; transient navigation/
// network hiccups there can surface as unhandled rejections instead of going
// through our own promise chains. Log them instead of letting them kill the
// whole server.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const accounts = require('./accounts');
const guestStore = require('./guestStore');
const { parseGuestsFromBuffer } = require('./excelParser');
const { normalizePhone, isPlausiblePhone } = require('./phone');
const sendJobs = require('./sendJobs');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadMedia = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let invitationMedia = null; // { data (base64), mimetype, filename }

// Decides which WhatsApp account should send to a given guest. With a single
// connected account, everyone routes through it regardless of the "side"
// column. With two or more, the guest's side must match a configured
// account's label (case/whitespace-insensitive).
function resolveAccount(guest) {
  const list = accounts.list();
  if (list.length === 1) return list[0];
  if (!guest.side) return null;
  return accounts.findByLabel(guest.side);
}

function withResolution(guest) {
  const account = resolveAccount(guest);
  return {
    ...guest,
    resolvedAccountId: account ? account.id : null,
    resolvedAccountLabel: account ? account.label : null,
  };
}

app.get('/api/accounts', (req, res) => {
  accounts.retryDisconnected();
  res.json({ accounts: accounts.list() });
});

app.post('/api/accounts', (req, res) => {
  const { label } = req.body || {};
  const id = accounts.create(label);
  res.json({ account: accounts.list().find((a) => a.id === id) });
});

app.patch('/api/accounts/:id', (req, res) => {
  const { label } = req.body || {};
  const account = accounts.rename(req.params.id, label);
  if (!account) return res.status(404).json({ error: 'חיבור לא נמצא' });
  res.json({ account: accounts.list().find((a) => a.id === req.params.id) });
});

app.post('/api/accounts/:id/logout', async (req, res) => {
  try {
    await accounts.logout(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  const ok = await accounts.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'חיבור לא נמצא' });
  res.json({ ok: true });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'לא הועלה קובץ' });
  }
  try {
    guestStore.setAll(await parseGuestsFromBuffer(req.file.buffer));
    res.json({ guests: guestStore.getAll().map(withResolution) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/guests', (req, res) => {
  res.json({ guests: guestStore.getAll().map(withResolution) });
});

app.post('/api/guests', (req, res) => {
  const { name, phone, side } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'יש להזין שם' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'יש להזין מספר טלפון' });
  }

  const normalized = normalizePhone(phone);
  const guest = guestStore.add({
    name: name.trim(),
    phone: normalized,
    phoneRaw: phone.trim(),
    side: side && side.trim() ? side.trim() : '',
    valid: isPlausiblePhone(normalized),
  });
  res.json({ guest: withResolution(guest) });
});

app.patch('/api/guests/:id', (req, res) => {
  const id = Number(req.params.id);
  const guest = guestStore.findById(id);
  if (!guest) {
    return res.status(404).json({ error: 'מוזמן לא נמצא' });
  }

  const { name, phone, side, customMessage } = req.body || {};

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'יש להזין שם' });
    guest.name = name.trim();
  }
  if (phone !== undefined) {
    if (!phone.trim()) return res.status(400).json({ error: 'יש להזין מספר טלפון' });
    guest.phoneRaw = phone.trim();
    guest.phone = normalizePhone(phone);
    guest.valid = isPlausiblePhone(guest.phone);
  }
  if (side !== undefined) {
    guest.side = side && side.trim() ? side.trim() : '';
  }
  if (customMessage !== undefined) {
    guest.customMessage = customMessage && customMessage.trim() ? customMessage : null;
  }

  res.json({ guest: withResolution(guest) });
});

app.post('/api/invitation-media', uploadMedia.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'לא הועלה קובץ' });
  }
  const isImage = req.file.mimetype.startsWith('image/');
  const isVideo = req.file.mimetype.startsWith('video/');
  if (!isImage && !isVideo) {
    return res.status(400).json({ error: 'הקובץ שהועלה חייב להיות תמונה או סרטון' });
  }

  invitationMedia = {
    data: req.file.buffer.toString('base64'),
    mimetype: req.file.mimetype,
    filename: req.file.originalname,
    kind: isVideo ? 'video' : 'image',
  };

  res.json({
    dataUrl: `data:${invitationMedia.mimetype};base64,${invitationMedia.data}`,
    kind: invitationMedia.kind,
  });
});

app.get('/api/invitation-media', (req, res) => {
  if (!invitationMedia) return res.json({ dataUrl: null, kind: null });
  res.json({
    dataUrl: `data:${invitationMedia.mimetype};base64,${invitationMedia.data}`,
    kind: invitationMedia.kind,
  });
});

app.delete('/api/invitation-media', (req, res) => {
  invitationMedia = null;
  res.json({ ok: true });
});

app.post('/api/send', (req, res) => {
  const { guestIds, message } = req.body || {};

  if (!accounts.list().some((a) => a.status === 'READY')) {
    return res.status(400).json({ error: 'אין אף חשבון וואטסאפ מחובר' });
  }
  if (!Array.isArray(guestIds) || guestIds.length === 0) {
    return res.status(400).json({ error: 'לא נבחרו מוזמנים' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'ההודעה ריקה' });
  }

  const idSet = new Set(guestIds);
  const selected = guestStore
    .getAll()
    .filter((g) => idSet.has(g.id) && g.valid)
    .map((g) => ({ ...g, accountId: resolveAccount(g)?.id || null }))
    .filter((g) => g.accountId);

  if (selected.length === 0) {
    return res.status(400).json({
      error: 'לאף אחד מהמוזמנים שנבחרו אין מספר טלפון תקין וצד מחובר שמזוהה עם חשבון וואטסאפ',
    });
  }

  const jobId = sendJobs.createJob(selected, message, invitationMedia);
  res.json({ jobId });
});

app.get('/api/send/:jobId/progress', (req, res) => {
  const job = sendJobs.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'לא נמצאה משימת שליחה' });
  res.json(job);
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'הקובץ גדול מדי' });
  }
  console.error(err);
  res.status(500).json({ error: 'שגיאת שרת' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  accounts.ensureDefault();
});
