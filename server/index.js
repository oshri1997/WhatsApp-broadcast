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

const whatsapp = require('./whatsappClient');
const { parseGuestsFromBuffer } = require('./excelParser');
const sendJobs = require('./sendJobs');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let guests = [];

app.get('/api/status', (req, res) => {
  const status = whatsapp.getStatus();
  if (status.status === 'DISCONNECTED') {
    whatsapp.init();
  }
  res.json(status);
});

app.post('/api/logout', async (req, res) => {
  try {
    await whatsapp.logout();
    whatsapp.init();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'לא הועלה קובץ' });
  }
  try {
    guests = await parseGuestsFromBuffer(req.file.buffer);
    res.json({ guests });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/guests', (req, res) => {
  res.json({ guests });
});

app.post('/api/send', (req, res) => {
  const { guestIds, message } = req.body || {};

  if (whatsapp.getStatus().status !== 'READY') {
    return res.status(400).json({ error: 'הוואטסאפ עדיין לא מחובר' });
  }
  if (!Array.isArray(guestIds) || guestIds.length === 0) {
    return res.status(400).json({ error: 'לא נבחרו מוזמנים' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'ההודעה ריקה' });
  }

  const idSet = new Set(guestIds);
  const selected = guests.filter((g) => idSet.has(g.id) && g.valid);

  if (selected.length === 0) {
    return res.status(400).json({ error: 'אף אחד מהמוזמנים שנבחרו אינו בעל מספר טלפון תקין' });
  }

  const jobId = sendJobs.createJob(selected, message);
  res.json({ jobId });
});

app.get('/api/send/:jobId/progress', (req, res) => {
  const job = sendJobs.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'לא נמצאה משימת שליחה' });
  res.json(job);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  whatsapp.init();
});
