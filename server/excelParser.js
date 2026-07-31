const ExcelJS = require('exceljs');
const { normalizePhone, isPlausiblePhone } = require('./phone');

const NAME_HEADERS = ['שם המוזמן', 'שם', 'name'];
const PHONE_HEADERS = ['מספר טלפון', 'טלפון', 'phone'];
const SIDE_HEADERS = ['צד', 'side'];

function cellText(cell) {
  if (cell == null) return '';
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value.text) return String(value.text);
    if (value.richText) return value.richText.map((r) => r.text).join('');
    if (value.result != null) return String(value.result);
    return '';
  }
  return String(value);
}

function findColumnIndex(headerRow, candidates) {
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = cellText(cell).trim();
  });

  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h === candidate);
    if (idx !== -1) return idx;
  }
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h && h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

async function parseGuestsFromBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];

  if (!sheet || sheet.rowCount < 2) {
    throw new Error('הקובץ ריק או שלא נמצאו שורות נתונים');
  }

  const headerRow = sheet.getRow(1);
  const nameCol = findColumnIndex(headerRow, NAME_HEADERS);
  const phoneCol = findColumnIndex(headerRow, PHONE_HEADERS);
  const sideCol = findColumnIndex(headerRow, SIDE_HEADERS);

  if (nameCol === -1 || phoneCol === -1) {
    throw new Error('לא נמצאו העמודות "שם המוזמן" ו/או "מספר טלפון" בקובץ');
  }

  const guests = [];
  let nextId = 1;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellText(row.getCell(nameCol)).trim();
    const phoneRaw = cellText(row.getCell(phoneCol)).trim();
    const side = sideCol !== -1 ? cellText(row.getCell(sideCol)).trim() : '';

    if (!name && !phoneRaw) continue;

    const normalized = normalizePhone(phoneRaw);

    guests.push({
      id: nextId++,
      name: name || '(ללא שם)',
      phone: normalized,
      phoneRaw,
      side,
      valid: isPlausiblePhone(normalized),
    });
  }

  return guests;
}

module.exports = { parseGuestsFromBuffer };
