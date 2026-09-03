import ExcelJS from 'exceljs';
import type { ResolvedGuest } from '@/lib/types';

export async function buildGuestExportBuffer(guests: ResolvedGuest[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('מוזמנים');

  sheet.columns = [
    { header: 'שם המוזמן', key: 'name', width: 22 },
    { header: 'מספר טלפון', key: 'phone', width: 16 },
    { header: 'צד', key: 'side', width: 14 },
    { header: 'הודעה אישית', key: 'customMessage', width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ rightToLeft: true }];

  for (const guest of guests) {
    sheet.addRow({
      name: guest.name,
      phone: guest.phoneRaw || guest.phone || '',
      side: guest.side || '',
      customMessage: guest.customMessage || '',
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
