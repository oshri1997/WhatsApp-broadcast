const ExcelJS = require('exceljs');

function rsvpLabel(guest) {
  if (!guest.invited) return 'טרם נשלחה הזמנה';
  if (guest.rsvpStatus === 'yes') return guest.rsvpAwaitingCount ? 'מגיע (ממתין לכמות)' : 'מגיע';
  if (guest.rsvpStatus === 'no') return 'לא מגיע';
  if (guest.rsvpStatus === 'maybe') return 'אולי';
  return 'ממתין לתשובה';
}

async function buildGuestExportWorkbook(guests) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('מוזמנים');

  sheet.columns = [
    { header: 'שם המוזמן', key: 'name', width: 22 },
    { header: 'מספר טלפון', key: 'phone', width: 16 },
    { header: 'צד', key: 'side', width: 14 },
    { header: 'אישור הגעה', key: 'rsvp', width: 20 },
    { header: 'כמות אורחים', key: 'count', width: 14 },
    { header: 'הודעה אישית', key: 'customMessage', width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ rightToLeft: true }];

  for (const guest of guests) {
    sheet.addRow({
      name: guest.name,
      phone: guest.phoneRaw || guest.phone || '',
      side: guest.side || '',
      rsvp: rsvpLabel(guest),
      count: guest.rsvpStatus === 'yes' && !guest.rsvpAwaitingCount ? guest.rsvpCount : '',
      customMessage: guest.customMessage || '',
    });
  }

  return workbook;
}

module.exports = { buildGuestExportWorkbook };
