import ExcelJS from 'exceljs';
import type { Guest } from '@/lib/types';
import { normalizePhone, isPlausiblePhone } from './phone';

const NAME_HEADERS = ['שם המוזמן', 'שם', 'name'];
const PHONE_HEADERS = ['מספר טלפון', 'טלפון', 'phone'];
const SIDE_HEADERS = ['צד', 'side'];

type ParsedGuest = Pick<Guest, 'id' | 'name' | 'phone' | 'phoneRaw' | 'side' | 'valid'>;

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (cell == null) return '';
  const value = cell.value as unknown;
  if (value == null) return '';
  if (typeof value === 'object') {
    const v = value as { text?: string; richText?: { text: string }[]; result?: unknown };
    if (v.text) return String(v.text);
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.result != null) return String(v.result);
    return '';
  }
  return String(value);
}

function findColumnIndex(headerRow: ExcelJS.Row, candidates: string[]): number {
  const headers: string[] = [];
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

export async function parseGuestsFromBuffer(buffer: Buffer): Promise<ParsedGuest[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    // exceljs surfaces its zip-parser's English internals here; anything that
    // isn't a real workbook lands in this branch.
    throw new Error('לא הצלחנו לקרוא את הקובץ - צריך קובץ אקסל תקין בפורמט ‎.xlsx');
  }
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

  const guests: ParsedGuest[] = [];
  let nextId = 1;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellText(row.getCell(nameCol)).trim();
    const phoneRaw = cellText(row.getCell(phoneCol)).trim();
    const side = sideCol !== -1 ? cellText(row.getCell(sideCol)).trim() : '';

    if (!name && !phoneRaw) continue;
    // Some spreadsheet tools repeat the header row as the first data row.
    // Never turn that structural row into an invalid guest.
    if (NAME_HEADERS.includes(name) && PHONE_HEADERS.includes(phoneRaw)) continue;

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
