import ExcelJS from 'exceljs';
import type { ResolvedGuest, SavedMessageTemplate } from '@/lib/types';

export async function buildGuestExportBuffer(guests: ResolvedGuest[], templates: SavedMessageTemplate[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('מוזמנים');

  sheet.columns = [
    { header: 'שם המוזמן', key: 'name', width: 22 },
    { header: 'מספר טלפון', key: 'phone', width: 16 },
    { header: 'צד', key: 'side', width: 14 },
    { header: 'תבנית', key: 'template', width: 22 },
    { header: 'הודעה אישית', key: 'customMessage', width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ rightToLeft: true }];
  const templateLabels = new Map(templates.map((template) => [template.id, template.label]));

  for (const guest of guests) {
    sheet.addRow({
      name: guest.name,
      phone: guest.phoneRaw || guest.phone || '',
      side: guest.side || '',
      template: guest.templateId ? templateLabels.get(guest.templateId) ?? '' : '',
      customMessage: guest.customMessage || '',
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
